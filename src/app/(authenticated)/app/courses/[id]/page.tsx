import { and, asc, desc, eq, exists } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CourseLearningPath } from "@/components/courses/course-learning-path";
import { CourseMaterialsPanel } from "@/components/courses/course-materials-panel";
import { CourseOutlineStatus } from "@/components/courses/course-outline-status";
import { MaterialList } from "@/components/courses/material-list";
import { getLearnerQuotas } from "@/lib/analytics/service";
import { db } from "@/db";
import {
  courses,
  lessons,
  materialChunks,
  materials,
  tutorSessions,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { isAdminEmail } from "@/lib/auth/authorization";
import { getLessonProgress } from "@/lib/assessments/service";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const canInspectRetrieval = isAdminEmail(user.email, env.ADMIN_EMAILS);
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const [course] = await db
    .select({
      id: courses.id,
      name: courses.name,
      title: courses.title,
      summary: courses.summary,
      status: courses.status,
      error: courses.generationError,
      sourceVersion: courses.sourceVersion,
      outlineVersion: courses.outlineVersion,
    })
    .from(courses)
    .where(and(eq(courses.id, parsed.data), eq(courses.ownerId, user.id)))
    .limit(1);
  if (!course) notFound();
  const sourceStates = await db
    .select({
      status: materials.status,
      indexed: exists(
        db
          .select({ id: materialChunks.id })
          .from(materialChunks)
          .where(
            and(
              eq(materialChunks.materialId, materials.id),
              eq(materialChunks.ownerId, user.id),
            ),
          ),
      ),
    })
    .from(materials)
    .where(
      and(eq(materials.courseId, course.id), eq(materials.ownerId, user.id)),
    );
  const canGenerate =
    sourceStates.length > 0 &&
    sourceStates.every((source) => source.status === "ready" && source.indexed);
  const outdated =
    course.outlineVersion >= 0 &&
    course.outlineVersion !== course.sourceVersion;
  const sessions = await db
    .select({
      id: tutorSessions.id,
      title: tutorSessions.lessonTitle,
      lessonId: tutorSessions.lessonId,
    })
    .from(tutorSessions)
    .where(
      and(
        eq(tutorSessions.courseId, course.id),
        eq(tutorSessions.ownerId, user.id),
      ),
    )
    .orderBy(desc(tutorSessions.updatedAt))
    .limit(50);
  const outline =
    course.outlineVersion >= 0
      ? await db
          .select({
            id: lessons.id,
            ordinal: lessons.ordinal,
            title: lessons.title,
            objective: lessons.objective,
            concepts: lessons.concepts,
          })
          .from(lessons)
          .where(
            and(eq(lessons.courseId, course.id), eq(lessons.ownerId, user.id)),
          )
          .orderBy(asc(lessons.ordinal))
      : [];

  const lessonProgress = await getLessonProgress(user.id, course.id);
  const completedIds = new Set(
    lessonProgress
      .filter((lesson) => lesson.completed)
      .map((lesson) => lesson.lessonId),
  );
  const hasOutline = course.outlineVersion >= 0;
  const issueCount = sourceStates.filter(
    (source) => source.status !== "ready" || !source.indexed,
  ).length;
  const quotas = await getLearnerQuotas(user.id);
  const outlineStatus = (
    <CourseOutlineStatus
      courseId={course.id}
      status={course.status}
      hasOutline={hasOutline}
      outdated={outdated}
      canGenerate={canGenerate}
      error={course.error}
    />
  );

  return (
    <main className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10">
      <Link href="/app" className="text-sm text-primary hover:underline">
        ← All courses
      </Link>
      <h1 className="mt-6 break-words text-3xl font-semibold tracking-tight">
        {course.name}
      </h1>
      {hasOutline ? (
        course.summary ? (
          <details open className="mt-3 text-sm text-muted-foreground">
            <summary className="w-fit cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
              About this course
            </summary>
            <p className="mt-2 leading-6">{course.summary}</p>
          </details>
        ) : null
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Add your material, then generate a course to start learning.
        </p>
      )}
      {hasOutline ? outlineStatus : null}
      {outline.length ? (
        <CourseLearningPath
          title={course.title ?? "Your learning path"}
          lessons={outline}
          completedIds={[...completedIds]}
          disabled={outdated || course.status !== "ready"}
          outdated={outdated}
          tutorTurnsRemaining={quotas.tutor.remaining}
        />
      ) : null}
      <CourseMaterialsPanel
        key={course.id}
        userId={user.id}
        courseId={course.id}
        hasOutline={hasOutline}
        materialCount={sourceStates.length}
        issueCount={issueCount}
        importsRemaining={quotas.ingestion.remaining}
      >
        <MaterialList
          ownerId={user.id}
          courseId={course.id}
          canInspectRetrieval={canInspectRetrieval}
        />
      </CourseMaterialsPanel>
      {!hasOutline ? outlineStatus : null}
      {sessions.length ? (
        <section className="mt-8" aria-labelledby="history-heading">
          <h2 id="history-heading" className="mb-3 text-lg font-semibold">
            Recent conversations
          </h2>
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  className="text-sm text-primary hover:underline"
                  href={`/app/sessions/${session.id}`}
                >
                  {session.title}
                  {!session.lessonId ? " · Previous outline" : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
