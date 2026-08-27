import "server-only";

import { streamText, type LanguageModel } from "ai";

import { env } from "@/lib/env";
import { retrieveCourseChunks } from "@/lib/rag/retrieval";
import { recordGateway } from "@/lib/usage/gateway";
import { releaseUnusedQuota } from "@/lib/usage/quotas";
import { TUTOR_OUTPUT_TOKENS, TUTOR_SYSTEM_PROMPT, TUTOR_TIMEOUT_MS, tutorContext, type TutorEvent } from "./contracts";
import { completeTutorTurn, failTutorTurn, TutorError, type PreparedTurn } from "./service";

export function streamTutorTurn(turn: PreparedTurn, model: LanguageModel = env.TUTOR_MODEL) {
  const encoder = new TextEncoder();
  let disconnected = false;
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(value) { controller = value; },
    cancel() { disconnected = true; },
  });
  function emit(event: TutorEvent) {
    if (!disconnected) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
  }
  const completion = (async () => {
    try {
      const signal = AbortSignal.timeout(TUTOR_TIMEOUT_MS);
      const usage = { ownerId: turn.ownerId, requestId: turn.requestId, reservationId: turn.reservationId };
      const sources = await retrieveCourseChunks({ ownerId: turn.ownerId, courseId: turn.session.courseId,
        query: `${turn.session.objective}\n${turn.session.retrievalQuery}\n${turn.message}`, signal, usage });
      let content = "";
      if (!sources.length) {
        content = "I couldn't find supporting passages in the course material. Which part of the lesson would you like to explore once the sources are indexed?";
        emit({ type: "delta", text: content });
      } else {
        await recordGateway(usage, "tutor", typeof model === "string" ? model : model.modelId, async (span) => {
          const result = streamText({ model, reasoning: "minimal", maxOutputTokens: TUTOR_OUTPUT_TOKENS,
            maxRetries: 0, abortSignal: signal, system: TUTOR_SYSTEM_PROMPT,
            // The ledger records safe error codes. Suppress the SDK's raw-error logger.
            onError() {},
            messages: [{ role: "user", content: tutorContext(turn.session, sources) }, ...turn.history, { role: "user", content: turn.message }],
          });
          let finished = false;
          for await (const part of result.fullStream) {
            if (part.type === "text-delta") { span.firstToken(); content += part.text; emit({ type: "delta", text: part.text }); }
            if (part.type === "reasoning-delta") span.firstToken();
            if (part.type === "finish-step") span.observe(part);
            if (part.type === "error") throw part.error;
            if (part.type === "abort") throw new DOMException("Generation aborted", "AbortError");
            if (part.type === "finish") {
              // Truncated/filtered answers are not presented as completed lessons.
              finished = part.finishReason === "stop";
              span.observe({ usage: part.totalUsage });
            }
          }
          if (!finished || !content.trim()) throw new Error("Incomplete tutor response");
        });
      }
      await completeTutorTurn(turn, content, sources.map((source) => source.id));
      emit({ type: "done", messageId: turn.messageId });
    } catch (error) {
      const message = error instanceof TutorError ? error.message : "The tutor could not finish this response. Your question is saved; refresh, then try again.";
      try { await failTutorTurn(turn, message); } catch { /* The bounded lease allows recovery after a database outage. */ }
      emit({ type: "error", error: message });
    } finally {
      if (turn.reservationId) {
        try { await releaseUnusedQuota(turn.reservationId, turn.ownerId); }
        catch { console.error("Tutor quota cleanup failed", { requestId: turn.requestId }); }
      }
      if (!disconnected) controller.close();
    }
  })();
  return { completion, response: new Response(body, { headers: {
    "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } }) };
}
