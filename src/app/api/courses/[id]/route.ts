import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { courses, materials } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { deleteCourseBlobs } from "@/lib/materials/blob-cleanup";
import { logServerError } from "@/lib/observability/logger";

const idSchema = z.uuid();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const parsed = idSchema.safeParse((await context.params).id);
  if (!parsed.success)
    return Response.json({ error: "Invalid course ID." }, { status: 400 });

  const ownedCourse = and(
    eq(courses.id, parsed.data),
    eq(courses.ownerId, user.id),
  );
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(ownedCourse)
    .limit(1);
  if (!course)
    return Response.json({ error: "Course not found." }, { status: 404 });

  const storedMaterials = await db
    .select({
      id: materials.id,
      blobPathname: materials.blobPathname,
      extractedTextBlobPathname: materials.extractedTextBlobPathname,
    })
    .from(materials)
    .where(
      and(eq(materials.courseId, course.id), eq(materials.ownerId, user.id)),
    );
  try {
    await deleteCourseBlobs(user.id, course.id, storedMaterials);
  } catch (error) {
    logServerError("course.blob_cleanup.failed", error, {
      courseId: course.id,
    });
    return Response.json(
      {
        error: "The course files could not be fully deleted. Please try again.",
      },
      { status: 502 },
    );
  }

  const deleted = await db.batch([
    db
      .delete(materials)
      .where(
        and(eq(materials.courseId, course.id), eq(materials.ownerId, user.id)),
      ),
    db.delete(courses).where(ownedCourse).returning({ id: courses.id }),
  ]);
  if (!deleted[1].length)
    return Response.json({ error: "Course not found." }, { status: 404 });
  return Response.json({ ok: true });
}
