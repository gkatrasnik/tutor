import { head, put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { courses, materials } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { materialUploadPrefix } from "@/lib/materials/constants";
import { logServerError } from "@/lib/observability/logger";
import {
  createTextSchema,
  registerPdfSchema,
  validateOwnedPdfBlob,
} from "@/lib/materials/validation";

export async function POST(request: Request) {
  const user = await requireUser();
  const body: unknown = await request.json().catch(() => null);
  const association = z.object({ courseId: z.uuid() }).safeParse(body);
  if (!association.success)
    return Response.json(
      { error: "Choose a course before adding material." },
      { status: 400 },
    );
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.id, association.data.courseId),
        eq(courses.ownerId, user.id),
      ),
    )
    .limit(1);
  if (!course)
    return Response.json({ error: "Course not found." }, { status: 404 });
  const sourceType =
    typeof body === "object" && body && "sourceType" in body
      ? body.sourceType
      : null;

  if (sourceType === "pdf") {
    const parsed = registerPdfSchema.safeParse(body);
    if (!parsed.success)
      return Response.json(
        { error: "Invalid PDF upload details." },
        { status: 400 },
      );

    try {
      const blob = await head(parsed.data.url);
      if (blob.pathname !== parsed.data.pathname) {
        return Response.json(
          { error: "The uploaded file could not be verified." },
          { status: 400 },
        );
      }
      const validationError = validateOwnedPdfBlob(user.id, blob);
      if (validationError)
        return Response.json({ error: validationError }, { status: 400 });
      if (
        !blob.pathname.startsWith(
          `${materialUploadPrefix(user.id)}${course.id}/`,
        )
      ) {
        return Response.json(
          { error: "This upload belongs to a different course." },
          { status: 400 },
        );
      }

      const [material] = await db
        .insert(materials)
        .values({
          courseId: course.id,
          ownerId: user.id,
          sourceType: "pdf",
          originalFilename: parsed.data.originalFilename,
          blobUrl: blob.url,
          blobPathname: blob.pathname,
          byteSize: blob.size,
        })
        .returning({ id: materials.id });

      return Response.json(material, { status: 201 });
    } catch (error) {
      logServerError("material.pdf_registration.failed", error, {
        courseId: course.id,
      });
      return Response.json(
        { error: "The uploaded PDF could not be verified." },
        { status: 400 },
      );
    }
  }

  if (sourceType === "text") {
    const parsed = createTextSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid pasted text." },
        { status: 400 },
      );
    }

    try {
      const blob = await put(
        `materials/${encodeURIComponent(user.id)}/uploads/${crypto.randomUUID()}.txt`,
        parsed.data.text,
        { access: "private", contentType: "text/plain; charset=utf-8" },
      );
      const [material] = await db
        .insert(materials)
        .values({
          courseId: course.id,
          ownerId: user.id,
          sourceType: "text",
          originalFilename: parsed.data.title,
          blobUrl: blob.url,
          blobPathname: blob.pathname,
          extractedTextBlobUrl: blob.url,
          extractedTextBlobPathname: blob.pathname,
          byteSize: new TextEncoder().encode(parsed.data.text).byteLength,
        })
        .returning({ id: materials.id });
      return Response.json(material, { status: 201 });
    } catch (error) {
      logServerError("material.text_registration.failed", error, {
        courseId: course.id,
      });
      return Response.json(
        {
          error:
            "Could not store your text. Check the Blob connection and try again.",
        },
        { status: 500 },
      );
    }
  }

  return Response.json(
    { error: "Choose a supported material type." },
    { status: 400 },
  );
}

export async function GET() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(materials)
    .where(eq(materials.ownerId, user.id));
  return Response.json(rows);
}
