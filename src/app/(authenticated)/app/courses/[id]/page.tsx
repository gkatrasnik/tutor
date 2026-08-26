import { and, asc, desc, eq, exists } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CourseAction } from "@/components/courses/course-action";
import { MaterialList } from "@/components/courses/material-list";
import { MaterialUploader } from "@/app/(authenticated)/app/materials/material-uploader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StartLesson } from "@/components/tutor/start-lesson";
import { db } from "@/db";
import { courses, lessons, materialChunks, materials, tutorSessions } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { getLessonProgress } from "@/lib/assessments/service";
import { courseProgress } from "@/lib/assessments/contracts";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const [course] = await db.select({
    id: courses.id, name: courses.name, title: courses.title, summary: courses.summary,
    status: courses.status, error: courses.generationError, sourceVersion: courses.sourceVersion, outlineVersion: courses.outlineVersion,
  }).from(courses).where(and(eq(courses.id, parsed.data), eq(courses.ownerId, user.id))).limit(1);
  if (!course) notFound();
  const sourceStates = await db.select({ status: materials.status,
    indexed: exists(db.select({ id: materialChunks.id }).from(materialChunks)
      .where(and(eq(materialChunks.materialId, materials.id), eq(materialChunks.ownerId, user.id)))),
  }).from(materials).where(and(eq(materials.courseId, course.id), eq(materials.ownerId, user.id)));
  const canGenerate = sourceStates.length > 0 && sourceStates.every((source) => source.status === "ready" && source.indexed);
  const outdated = course.outlineVersion >= 0 && course.outlineVersion !== course.sourceVersion;
  const sessions = await db.select({ id: tutorSessions.id, title: tutorSessions.lessonTitle, lessonId: tutorSessions.lessonId })
    .from(tutorSessions).where(and(eq(tutorSessions.courseId, course.id), eq(tutorSessions.ownerId, user.id)))
    .orderBy(desc(tutorSessions.updatedAt)).limit(50);
  const outline = course.outlineVersion >= 0
    ? await db.select({ id: lessons.id, ordinal: lessons.ordinal, title: lessons.title, objective: lessons.objective, concepts: lessons.concepts })
      .from(lessons).where(and(eq(lessons.courseId, course.id), eq(lessons.ownerId, user.id))).orderBy(asc(lessons.ordinal))
    : [];

  const lessonProgress = await getLessonProgress(user.id, course.id);
  const completedIds = new Set(lessonProgress.filter((lesson) => lesson.completed).map((lesson) => lesson.lessonId));
  const progress = courseProgress(outline.length, completedIds.size);

  return (
    <main className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10">
      <Link href="/app" className="text-sm text-emerald-700 hover:underline">← All courses</Link>
      <p className="mt-8 text-sm font-medium text-emerald-700">Your course</p>
      <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight">{course.name}</h1>
      <p className="mt-3 text-sm text-stone-500">Add your sources below, then generate an outline using all of them together.</p>
      <Card className="mt-8 bg-white">
        <CardHeader><CardTitle>Add course material</CardTitle><CardDescription>Upload multiple PDFs one at a time or add several sets of notes. Uploading indexes the material; it does not generate an outline.</CardDescription></CardHeader>
        <CardContent><MaterialUploader userId={user.id} courseId={course.id} /></CardContent>
      </Card>
      <section className="mt-8" aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="mb-3 text-lg font-semibold">Course materials · {sourceStates.length}</h2>
        <MaterialList ownerId={user.id} courseId={course.id} />
      </section>
      <Card className="mt-8 bg-white">
        <CardHeader>
          <CardTitle>{outdated ? "Your outline is out of date" : course.status === "generating" ? "Generating your outline" : course.status === "failed" ? "Outline generation needs attention" : course.outlineVersion >= 0 ? "Your outline is up to date" : "Ready to build your learning path?"}</CardTitle>
          <CardDescription>{outdated ? "Your materials changed. Update the outline to include the current sources; the previous outline remains below until the update succeeds." : "Generate one 4–8 lesson outline after adding all your sources. Limits: 300 chunks and 200,000 indexed characters across the course."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {course.error ? <p role="alert" className="text-sm text-red-700">{course.error}</p> : null}
          {!canGenerate ? <p className="text-sm text-stone-500">Add and index at least one material. All attached materials must be indexed before generation.</p> : null}
          {course.status === "generating" ? <p className="text-sm text-stone-500">Check again shortly. Interrupted attempts can be retried after five minutes.</p> : null}
          {course.status === "ready" && !outdated ? <Badge variant="secondary">Outline ready</Badge> : <CourseAction courseId={course.id} status={course.status} outdated={outdated} disabled={!canGenerate} />}
        </CardContent>
      </Card>
      {outline.length ? (
        <>
          <p className="mt-5 leading-7 text-stone-600">{course.summary}</p>
          <Card className="mt-8 bg-white">
            <CardHeader>
              <CardTitle>{course.title ?? "Your learning path"}</CardTitle>
              <CardDescription>{outline.length} ordered lessons · Open a lesson to see what you will learn.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-xs text-stone-500">{progress.completed} of {progress.total} lessons completed · {progress.percent}%</p>
              <Progress value={progress.percent} aria-label={`${progress.completed} of ${progress.total} lessons completed`} />
              {outdated ? <p className="mt-2 text-xs text-stone-500">Progress applies to current sources only. Previous assessments remain in conversation history.</p> : null}
              <Accordion className="mt-5" defaultValue={outline.length ? [outline[0].id] : []}>
                {outline.map((lesson) => (
                  <AccordionItem key={lesson.id} value={lesson.id}>
                    <AccordionTrigger className="gap-4 py-5">
                      <span className="text-emerald-700">{String(lesson.ordinal + 1).padStart(2, "0")}</span>
                      <span className="flex-1">{lesson.title}</span>
                      {completedIds.has(lesson.id) ? <Badge variant="secondary">Complete</Badge> : null}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 pl-8">
                      <p className="leading-6 text-stone-600">{lesson.objective}</p>
                      <div className="mt-3 flex flex-wrap gap-2" aria-label="Key concepts">
                        {lesson.concepts.map((concept, index) => <Badge key={`${index}-${concept}`} variant="secondary" className="h-auto whitespace-normal text-left">{concept}</Badge>)}
                      </div>
                      <StartLesson lessonId={lesson.id} disabled={outdated || course.status !== "ready"} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
          <p className="mt-5 text-sm text-stone-500">Use Finish lesson in the conversation to assess your understanding. A saved score of 70 or higher completes that lesson.</p>
        </>
      ) : null}
      {sessions.length ? <section className="mt-8" aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3 text-lg font-semibold">Recent conversations</h2>
        <ul className="space-y-2">{sessions.map((session) => <li key={session.id}><Link className="text-sm text-emerald-700 hover:underline" href={`/app/sessions/${session.id}`}>{session.title}{!session.lessonId ? " · Previous outline" : ""}</Link></li>)}</ul>
      </section> : null}
    </main>
  );
}
