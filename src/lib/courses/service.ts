import "server-only";

import { and, asc, eq, exists, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { courses, lessons, materialChunks, materials } from "@/db/schema";

import { generateCourseOutline } from "./generation";
import {
  COURSE_LEASE_MS,
  MAX_COURSE_CHUNKS,
  MAX_COURSE_SOURCE_CHARACTERS,
} from "./outline";

export class CourseGenerationError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export type CourseGenerationResult = {
  id: string;
  status: "generating" | "ready";
};

export async function ensureCourseOutline(
  courseId: string,
  ownerId: string,
): Promise<CourseGenerationResult> {
  const ownedCourse = and(
    eq(courses.id, courseId),
    eq(courses.ownerId, ownerId),
  );
  const [existing] = await db
    .select({
      id: courses.id,
      name: courses.name,
      status: courses.status,
      sourceVersion: courses.sourceVersion,
      outlineVersion: courses.outlineVersion,
    })
    .from(courses)
    .where(ownedCourse)
    .limit(1);
  if (!existing) throw new CourseGenerationError("Course not found.", 404);
  if (
    existing.status === "ready" &&
    existing.outlineVersion === existing.sourceVersion
  )
    return { id: courseId, status: "ready" };

  const sources = await db
    .select({
      id: materials.id,
      filename: materials.originalFilename,
      status: materials.status,
    })
    .from(materials)
    .where(
      and(eq(materials.courseId, courseId), eq(materials.ownerId, ownerId)),
    )
    .orderBy(asc(materials.createdAt), asc(materials.id));
  if (!sources.length)
    throw new CourseGenerationError(
      "Add at least one material before generating an outline.",
      409,
    );
  if (sources.some((source) => source.status !== "ready")) {
    throw new CourseGenerationError(
      "Index all course materials first, or remove the ones you do not want to include.",
      409,
    );
  }
  const chunks = await db
    .select({
      materialId: materialChunks.materialId,
      ordinal: materialChunks.ordinal,
      pageNumber: materialChunks.pageNumber,
      content: materialChunks.content,
    })
    .from(materialChunks)
    .innerJoin(materials, eq(materials.id, materialChunks.materialId))
    .where(
      and(
        eq(materials.courseId, courseId),
        eq(materials.ownerId, ownerId),
        eq(materialChunks.ownerId, ownerId),
      ),
    )
    .orderBy(asc(materialChunks.materialId), asc(materialChunks.ordinal))
    .limit(MAX_COURSE_CHUNKS + 1);
  if (
    chunks.length > MAX_COURSE_CHUNKS ||
    chunks.reduce((total, chunk) => total + chunk.content.length, 0) >
      MAX_COURSE_SOURCE_CHARACTERS
  ) {
    throw new CourseGenerationError(
      "This course exceeds the outline limit of 300 chunks or 200,000 indexed characters. Split the sources into smaller courses.",
      422,
    );
  }
  const sourceMaterials = sources.map((source) => ({
    id: source.id,
    filename: source.filename,
    chunks: chunks
      .filter((chunk) => chunk.materialId === source.id)
      .map(({ ordinal, pageNumber, content }) => ({
        ordinal,
        pageNumber,
        content,
      })),
  }));
  if (sourceMaterials.some((source) => !source.chunks.length)) {
    throw new CourseGenerationError(
      "Every course material must have an index. Index the missing materials first.",
      409,
    );
  }

  const token = crypto.randomUUID();
  const [claimed] = await db
    .update(courses)
    .set({
      status: "generating",
      generationToken: token,
      generationStartedAt: sql`now()`,
      generationError: null,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        ownedCourse,
        eq(courses.sourceVersion, existing.sourceVersion),
        or(
          eq(courses.status, "pending"),
          eq(courses.status, "failed"),
          and(
            eq(courses.status, "ready"),
            sql`${courses.outlineVersion} <> ${courses.sourceVersion}`,
          ),
          and(
            eq(courses.status, "generating"),
            sql`${courses.generationStartedAt} < now() - ${COURSE_LEASE_MS} * interval '1 millisecond'`,
          ),
        ),
      ),
    )
    .returning({ id: courses.id });

  if (!claimed) {
    const [current] = await db
      .select({
        id: courses.id,
        status: courses.status,
        sourceVersion: courses.sourceVersion,
        outlineVersion: courses.outlineVersion,
      })
      .from(courses)
      .where(ownedCourse)
      .limit(1);
    if (current?.status === "generating")
      return { id: current.id, status: "generating" };
    if (
      current?.status === "ready" &&
      current.sourceVersion === current.outlineVersion
    )
      return { id: current.id, status: "ready" };
    throw new CourseGenerationError(
      "The course could not be started. Please retry.",
      409,
    );
  }

  const attemptGuard = and(
    ownedCourse,
    eq(courses.generationToken, token),
    eq(courses.status, "generating"),
  );
  const publishGuard = and(
    attemptGuard,
    eq(courses.sourceVersion, existing.sourceVersion),
  );
  try {
    const outline = await generateCourseOutline(
      { courseName: existing.name, materials: sourceMaterials },
      { ownerId, requestId: token },
    );
    const lessonValues = outline.lessons.map(
      (lesson, ordinal) => sql`(
      ${ordinal}::integer, ${lesson.title}::text, ${lesson.objective}::text,
      ${JSON.stringify(lesson.concepts)}::jsonb, ${lesson.retrievalQuery}::text
    )`,
    );

    // The HTTP transaction locks the course before replacing lessons. Source
    // revision triggers take the same lock, so changed sources cannot be
    // published as current. A failed replacement retains the previous outline.
    const saved = await db.batch([
      db.execute(
        sql`select id from ${courses} where ${publishGuard} for update`,
      ),
      db
        .delete(lessons)
        .where(
          and(
            eq(lessons.courseId, courseId),
            eq(lessons.ownerId, ownerId),
            exists(
              db.select({ id: courses.id }).from(courses).where(publishGuard),
            ),
          ),
        ),
      db.execute(sql`
      insert into ${lessons} (course_id, owner_id, ordinal, title, objective, concepts, retrieval_query)
      select ${courses.id}, ${ownerId}, item.ordinal, item.title, item.objective, item.concepts, item.retrieval_query
      from ${courses} cross join (values ${sql.join(lessonValues, sql`, `)})
        as item(ordinal, title, objective, concepts, retrieval_query)
      where ${publishGuard}
      returning id
      `),
      db
        .update(courses)
        .set({
          status: "ready",
          title: outline.title,
          summary: outline.summary,
          lessonCount: outline.lessons.length,
          outlineVersion: existing.sourceVersion,
          generationError: null,
          updatedAt: sql`now()`,
        })
        .where(publishGuard)
        .returning({ id: courses.id }),
    ]);
    if (saved[3].length !== 1) {
      throw new CourseGenerationError(
        "The course materials changed or this attempt was superseded. Generate the outline again.",
        409,
      );
    }
    return { id: claimed.id, status: "ready" };
  } catch (error) {
    const message =
      error instanceof CourseGenerationError
        ? error.message
        : "Your materials are indexed, but the course outline could not be generated or saved. Please retry the outline.";
    await db
      .update(courses)
      .set({
        status: "failed",
        generationError: message,
        updatedAt: sql`now()`,
      })
      .where(attemptGuard);
    throw new CourseGenerationError(
      message,
      error instanceof CourseGenerationError ? error.status : 502,
      { cause: error },
    );
  }
}
