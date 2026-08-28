import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { assessmentInputSchema } from "@/lib/assessments/contracts";
import { assessLesson, getAssessmentHistory } from "@/lib/assessments/service";
import { logServerError } from "@/lib/observability/logger";
import { TutorError } from "@/lib/tutor/service";
import { enforceAiRateLimit } from "@/lib/usage/rate-limit";
import { aiLimitResponse } from "@/lib/usage/contracts";

export const maxDuration = 120;
type Context = { params: Promise<{ id: string }> };
function failure(error: unknown, event: string) {
  const limited = aiLimitResponse(error);
  if (limited) return limited;
  if (!(error instanceof TutorError)) logServerError(event, error);
  return Response.json(
    {
      error:
        error instanceof TutorError
          ? error.message
          : "Could not load or save the assessment. Refresh before trying again.",
    },
    {
      status: error instanceof TutorError ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function GET(request: Request, context: Context) {
  const user = await requireUser();
  const id = z.uuid().safeParse((await context.params).id);
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .safeParse(new URL(request.url).searchParams.get("offset") ?? 0);
  if (!id.success || !offset.success)
    return Response.json(
      { error: "Invalid assessment history request." },
      { status: 400 },
    );
  try {
    return Response.json(
      await getAssessmentHistory(id.data, user.id, offset.data),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error, "assessment.history.failed");
  }
}

export async function POST(request: Request, context: Context) {
  const user = await requireUser();
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success)
    return Response.json({ error: "Invalid session ID." }, { status: 400 });
  const raw = await request.text();
  if (raw.length > 1000)
    return Response.json(
      { error: "Assessment request is too large." },
      { status: 413 },
    );
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json(
      { error: "Invalid assessment request." },
      { status: 400 },
    );
  }
  const input = assessmentInputSchema.safeParse(body);
  if (!input.success)
    return Response.json(
      {
        error:
          "Send only a valid request ID. Assessment evidence is loaded on the server.",
      },
      { status: 400 },
    );
  try {
    await enforceAiRateLimit(user.id, request);
    return Response.json(
      await assessLesson(id.data, user.id, input.data.requestId),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error, "assessment.create.failed");
  }
}
