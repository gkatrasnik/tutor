import { z } from "zod";

import { requireUser } from "@/lib/auth/dal";
import {
  MaterialProcessingError,
  processMaterial,
} from "@/lib/materials/processing";
import { logServerError } from "@/lib/observability/logger";
import { enforceAiRateLimit } from "@/lib/usage/rate-limit";
import { aiLimitResponse } from "@/lib/usage/contracts";

const idSchema = z.uuid();

export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const parsed = idSchema.safeParse((await context.params).id);
  if (!parsed.success)
    return Response.json({ error: "Invalid material ID." }, { status: 400 });

  try {
    await enforceAiRateLimit(user.id, request);
    await processMaterial(parsed.data, user.id);
  } catch (error) {
    const limited = aiLimitResponse(error);
    if (limited) return limited;
    if (!(error instanceof MaterialProcessingError))
      logServerError("material.processing.failed", error, {
        materialId: parsed.data,
      });
    const message =
      error instanceof MaterialProcessingError
        ? error.message
        : "Material processing failed.";
    return Response.json(
      { error: message },
      { status: error instanceof MaterialProcessingError ? 422 : 500 },
    );
  }

  // Learners choose when all course sources are ready; indexing never generates.
  return Response.json({ ok: true });
}
