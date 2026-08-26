import { after } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/dal";
import { tutorInputSchema } from "@/lib/tutor/contracts";
import { prepareTutorTurn, TutorError } from "@/lib/tutor/service";
import { streamTutorTurn } from "@/lib/tutor/stream";

export const maxDuration = 120;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) return Response.json({ error: "Invalid session ID." }, { status: 400 });
  const raw = await request.text();
  if (raw.length > 12_000) return Response.json({ error: "Message is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid message." }, { status: 400 }); }
  const input = tutorInputSchema.safeParse(body);
  if (!input.success) return Response.json({ error: "Send a message of 1–2,000 characters with a valid request ID." }, { status: 400 });
  try {
    const turn = await prepareTutorTurn(id.data, user.id, input.data.requestId, input.data.message);
    if ("replay" in turn) return new Response(`${JSON.stringify({ type: "done", messageId: turn.replay })}\n`, {
      headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
    });
    const stream = streamTutorTurn(turn);
    // Keep consuming/persisting if the browser disconnects, within maxDuration.
    // Authentication and ownership have already been captured before streaming.
    after(() => stream.completion);
    return stream.response;
  } catch (error) { return Response.json({ error: error instanceof TutorError ? error.message : "Could not start the tutor. Please try again." }, { status: error instanceof TutorError ? error.status : 500 }); }
}
