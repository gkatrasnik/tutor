import { z } from "zod";

import { requireUser } from "@/lib/auth/dal";
import { MaterialProcessingError, processMaterial } from "@/lib/materials/processing";

const idSchema = z.uuid();

export const maxDuration = 60;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const parsed = idSchema.safeParse((await context.params).id);
  if (!parsed.success) return Response.json({ error: "Invalid material ID." }, { status: 400 });

  try {
    await processMaterial(parsed.data, user.id);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof MaterialProcessingError ? error.message : "Material processing failed.";
    return Response.json({ error: message }, { status: 422 });
  }
}
