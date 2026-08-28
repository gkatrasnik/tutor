import { and, count, desc, eq } from "drizzle-orm";
import { BookOpenText, Database, MessageCircle } from "lucide-react";
import Link from "next/link";

import { CreateCourseForm } from "@/components/courses/create-course-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { db } from "@/db";
import { courses, materials } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { getLessonProgress } from "@/lib/assessments/service";
import { courseProgress } from "@/lib/assessments/contracts";
import { getLearnerQuotas } from "@/lib/analytics/service";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const user = await requireUser();
  const firstName = user.name?.trim().split(/\s+/)[0] || "learner";
  const quotas = await getLearnerQuotas(user.id);
  const library = await db
    .select({
      courseId: courses.id,
      name: courses.name,
      summary: courses.summary,
      status: courses.status,
      lessonCount: courses.lessonCount,
      error: courses.generationError,
      sourceVersion: courses.sourceVersion,
      outlineVersion: courses.outlineVersion,
      materialCount: count(materials.id),
    })
    .from(courses)
    .leftJoin(
      materials,
      and(eq(materials.courseId, courses.id), eq(materials.ownerId, user.id)),
    )
    .where(eq(courses.ownerId, user.id))
    .groupBy(courses.id)
    .orderBy(desc(courses.createdAt));
  const lessonProgress = await getLessonProgress(user.id);
  const progressByCourse = new Map(
    library.map((course) => {
      const current = lessonProgress.filter(
        (lesson) => lesson.courseId === course.courseId,
      );
      return [
        course.courseId,
        courseProgress(
          current.length,
          current.filter((lesson) => lesson.completed).length,
        ),
      ];
    }),
  );
  const quotaCards = [
    { label: "Tutor turns", icon: MessageCircle, ...quotas.tutor },
    { label: "Material ingestion", icon: Database, ...quotas.ingestion },
  ];

  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">
            Your learning space
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Explore a learning path grounded in your own material.
          </p>
        </div>
      </div>
      <section
        className="mt-8 grid gap-4 sm:grid-cols-2"
        aria-label="Daily quota remaining"
      >
        {quotaCards.map((quota) => (
          <Card key={quota.label} className="bg-card">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <quota.icon
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  {quota.label}
                </CardTitle>
                <Badge variant="outline">Resets 00:00 UTC</Badge>
              </div>
              <CardDescription>
                {quota.remaining} remaining today · {quota.used} of{" "}
                {quota.limit} used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress
                value={quota.limit ? (quota.used / quota.limit) * 100 : 0}
                aria-label={`${quota.label}: ${quota.used} of ${quota.limit} used`}
              />
            </CardContent>
          </Card>
        ))}
      </section>
      <Card className="mt-8 bg-card">
        <CardHeader>
          <CardTitle>Create a course</CardTitle>
          <CardDescription>
            Give it a name, add your materials, then generate one shared
            learning path.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateCourseForm />
        </CardContent>
      </Card>
      <section className="mt-10" aria-labelledby="courses-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="courses-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Your courses
          </h2>
          <Badge variant="outline">
            {library.length} {library.length === 1 ? "course" : "courses"}
          </Badge>
        </div>
        {library.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {library.map((course) => (
              <Card key={course.courseId} className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <BookOpenText className="size-5" aria-hidden="true" />
                    </span>
                    <Badge
                      variant={
                        course.status === "failed" ? "destructive" : "secondary"
                      }
                    >
                      {course.status === "generating"
                        ? "Generating"
                        : course.status === "failed"
                          ? "Needs attention"
                          : course.outlineVersion >= 0 &&
                              course.outlineVersion !== course.sourceVersion
                            ? "Outline out of date"
                            : course.status === "ready"
                              ? `${course.lessonCount} lessons`
                              : "Draft"}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4 break-words text-xl">
                    {course.name}
                  </CardTitle>
                  <CardDescription>
                    {course.materialCount}{" "}
                    {course.materialCount === 1 ? "material" : "materials"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {course.summary ? (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {course.summary}
                    </p>
                  ) : null}
                  {course.status === "ready" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {progressByCourse.get(course.courseId)!.completed} of{" "}
                        {progressByCourse.get(course.courseId)!.total} lessons
                        completed ·{" "}
                        {progressByCourse.get(course.courseId)!.percent}%
                      </p>
                      <Progress
                        value={progressByCourse.get(course.courseId)!.percent}
                        aria-label={`Course progress: ${progressByCourse.get(course.courseId)!.percent}%`}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {course.error ??
                        (course.status === "generating"
                          ? "Your outline is being prepared. Open the course to check its progress."
                          : "Add your sources and generate an outline when you are ready.")}
                    </p>
                  )}
                  <Link
                    href={`/app/courses/${course.courseId}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Open course
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-border bg-transparent shadow-none">
            <CardContent className="px-6 py-10 text-center">
              <h3 className="font-semibold">Create your first course above</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Each course can bring together several PDFs and sets of notes.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
