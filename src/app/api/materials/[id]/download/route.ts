import { get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { materials } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { logServerError } from "@/lib/observability/logger";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const parsed = z.uuid().safeParse((await context.params).id);
  if (!parsed.success)
    return Response.json({ error: "Invalid material ID." }, { status: 400 });

  const [material] = await db
    .select()
    .from(materials)
    .where(and(eq(materials.id, parsed.data), eq(materials.ownerId, user.id)))
    .limit(1);
  if (!material)
    return Response.json({ error: "Material not found." }, { status: 404 });

  try {
    const result = await get(material.blobPathname, { access: "private" });
    if (!result || result.statusCode !== 200)
      return Response.json({ error: "File not found." }, { status: 404 });

    const extension = material.sourceType === "pdf" ? ".pdf" : ".txt";
    let filename = material.originalFilename.replace(
      /[\u0000-\u001f\u007f/\\]/g,
      "_",
    );
    if (!filename.toLowerCase().endsWith(extension)) filename += extension;
    const encoded = encodeURIComponent(filename).replace(
      /['()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );

    return new Response(result.stream, {
      headers: {
        "Content-Type":
          material.sourceType === "pdf"
            ? "application/pdf"
            : "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="material${extension}"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logServerError("material.download.failed", error, {
      materialId: material.id,
    });
    return Response.json(
      { error: "The file could not be downloaded. Please try again." },
      { status: 502 },
    );
  }
}
