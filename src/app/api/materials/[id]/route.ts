import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { materials } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";

const idSchema = z.uuid();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const parsed = idSchema.safeParse((await context.params).id);
  if (!parsed.success)
    return Response.json({ error: "Invalid material ID." }, { status: 400 });

  const [material] = await db
    .select()
    .from(materials)
    .where(and(eq(materials.id, parsed.data), eq(materials.ownerId, user.id)))
    .limit(1);
  if (!material)
    return Response.json({ error: "Material not found." }, { status: 404 });

  const paths = [
    material.blobPathname,
    material.extractedTextBlobPathname,
  ].filter((value): value is string => Boolean(value));
  await del([...new Set(paths)]);
  await db
    .delete(materials)
    .where(and(eq(materials.id, parsed.data), eq(materials.ownerId, user.id)));
  return Response.json({ ok: true });
}
