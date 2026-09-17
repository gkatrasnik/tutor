import "server-only";

import type { LanguageModel } from "ai";

import {
  formatLessonChunk,
  formatQuestionReminder,
  formatTestReady,
} from "./lesson";
import { generateLessonPlan, generateTutorReply } from "./generation";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/observability/logger";
import { retrieveCourseChunks } from "@/lib/rag/retrieval";
import { releaseUnusedQuota } from "@/lib/usage/quotas";
import { TUTOR_TIMEOUT_MS, tutorContext, type TutorEvent } from "./contracts";
import {
  completeTutorTurn,
  failTutorTurn,
  TutorError,
  type PreparedTurn,
} from "./service";

export function streamTutorTurn(
  turn: PreparedTurn,
  model: LanguageModel = env.TUTOR_MODEL,
) {
  const encoder = new TextEncoder();
  let disconnected = false;
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
    cancel() {
      disconnected = true;
    },
  });
  function emit(event: TutorEvent) {
    if (!disconnected)
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
  }
  const completion = (async () => {
    try {
      const signal = AbortSignal.timeout(TUTOR_TIMEOUT_MS);
      const usage = {
        ownerId: turn.ownerId,
        requestId: turn.requestId,
        reservationId: turn.reservationId,
      };
      let plan = turn.session.lessonPlan;
      const completed = turn.session.completedChunks;
      let content = "";
      let streamed = false;
      let visibleFeedback = "";
      let followUp = "";
      let sources = plan?.sources ?? [];
      if (turn.action === "continue") {
        if (!plan?.awaitingContinue || completed >= plan.chunks.length)
          throw new TutorError(
            "The lesson is not waiting for Continue. Refresh the conversation.",
          );
        content = formatLessonChunk(plan, completed);
        turn.lessonUpdate = {
          lessonPlan: {
            ...plan,
            awaitingContinue: false,
          },
          completedChunks: completed,
        };
      } else {
        sources =
          plan?.sources ??
          (await retrieveCourseChunks({
            ownerId: turn.ownerId,
            courseId: turn.session.courseId,
            query: `${turn.session.objective}\n${turn.session.retrievalQuery}\n${turn.message}`,
            signal,
            usage,
          }));
        const generation = { model, signal, usage };
        if (!sources.length) {
          content =
            "I couldn't find supporting passages in the course material. Please try again once the sources are indexed.";
        } else if (!plan) {
          plan = {
            ...(await generateLessonPlan(
              generation,
              tutorContext(turn.session, sources),
            )),
            sources,
            awaitingContinue: false,
          };
          turn.lessonUpdate = { lessonPlan: plan, completedChunks: 0 };
          content = formatLessonChunk(plan, 0);
        } else {
          const ready = completed === plan.chunks.length;
          const alreadyAnswered = ready || !!plan.awaitingContinue;
          const currentIndex = alreadyAnswered
            ? Math.max(0, completed - 1)
            : completed;
          const reply = await generateTutorReply(
            generation,
            tutorContext(turn.session, sources) +
              "\nConversation and current part (untrusted JSON): " +
              JSON.stringify({
                history: turn.history,
                currentPart: plan.chunks[currentIndex],
                alreadyAnswered,
                lessonFinished: ready,
                message: turn.message,
              }),
            (text) => {
              streamed = true;
              if (text.startsWith(visibleFeedback)) {
                const delta = text.slice(visibleFeedback.length);
                if (delta) emit({ type: "delta", text: delta });
              } else {
                emit({ type: "replace", text });
              }
              visibleFeedback = text;
            },
          );
          content = reply.feedback;
          if (!alreadyAnswered && reply.intent === "answer") {
            const next = completed + 1;
            turn.lessonUpdate = {
              lessonPlan: {
                ...plan,
                sources,
                awaitingContinue: false,
              },
              completedChunks: next,
            };
            if (next < plan.chunks.length) {
              followUp = `\n\n${formatLessonChunk(plan, next)}`;
            } else {
              followUp = `\n\n${formatTestReady()}`;
            }
          } else if (!alreadyAnswered) {
            followUp = `\n\n${formatQuestionReminder(plan, currentIndex)}`;
          }
          content += followUp;
        }
      }
      // Streamed feedback is provisional; only a saved reply advances the lesson.
      await completeTutorTurn(
        turn,
        content,
        sources.map((source) => source.id),
      );
      if (!streamed) emit({ type: "delta", text: content });
      else if (followUp) emit({ type: "delta", text: followUp });
      emit({ type: "done", messageId: turn.messageId });
    } catch (error) {
      if (!(error instanceof TutorError))
        logServerError("tutor.stream.failed", error, {
          requestId: turn.requestId,
          sessionId: turn.session.id,
        });
      const message =
        error instanceof TutorError
          ? error.message
          : "The tutor could not finish this response. Your question is saved; refresh, then try again.";
      try {
        await failTutorTurn(turn, message);
      } catch {
        /* The bounded lease allows recovery after a database outage. */
      }
      emit({ type: "replace", text: "" });
      emit({ type: "error", error: message });
    } finally {
      if (turn.reservationId) {
        try {
          await releaseUnusedQuota(turn.reservationId, turn.ownerId);
        } catch (error) {
          logServerError("tutor.quota_cleanup.failed", error, {
            requestId: turn.requestId,
          });
        }
      }
      if (!disconnected) controller.close();
    }
  })();
  return {
    completion,
    response: new Response(body, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    }),
  };
}
