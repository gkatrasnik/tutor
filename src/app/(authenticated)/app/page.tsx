import { ArrowRight, BookOpenText, FileUp, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/dal";

const courses = [
  {
    title: "The science of attention",
    source: "attention-and-memory.pdf",
    progress: 25,
    detail: "1 of 4 lessons",
  },
  {
    title: "Foundations of systems thinking",
    source: "systems-notes.pdf",
    progress: 67,
    detail: "4 of 6 lessons",
  },
];

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const user = await requireUser();
  const firstName = user.name?.trim().split(/\s+/)[0] || "learner";

  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-emerald-700">Your learning space</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-950">Welcome back, {firstName}.</h1>
          <p className="mt-2 text-stone-500">Pick up where you left off or turn new material into a course.</p>
        </div>
        <Link href="/app/materials" className={buttonVariants({ size: "lg" })}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          Add material
        </Link>
      </div>

      <section className="mt-10" aria-labelledby="continue-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="continue-heading" className="text-lg font-semibold tracking-tight">Continue learning</h2>
          <Badge variant="outline">2 active</Badge>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {courses.map((course, index) => (
            <Card key={course.title} className="group border-stone-200 bg-white transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <span className={index === 0
                    ? "flex size-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800"
                    : "flex size-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"}>
                    <BookOpenText className="size-5" aria-hidden="true" />
                  </span>
                  <Button variant="ghost" size="icon" aria-label={`More options for ${course.title}`}>
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </div>
                <CardTitle className="mt-4 text-xl">{course.title}</CardTitle>
                <CardDescription className="truncate">From {course.source}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex justify-between text-xs text-stone-500">
                  <span>{course.detail}</span>
                  <span>{course.progress}%</span>
                </div>
                <Progress value={course.progress} aria-label={`${course.progress}% complete`} />
                <Button variant="outline" className="mt-5 w-full justify-between">
                  Continue course
                  <ArrowRight aria-hidden="true" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="new-course-heading">
        <Card className="border-dashed border-stone-300 bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-stone-600 shadow-sm ring-1 ring-stone-200">
              <FileUp className="size-5" aria-hidden="true" />
            </span>
            <h2 id="new-course-heading" className="mt-4 font-semibold">Learn something new</h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-stone-500">
              Upload a PDF or paste your notes. Tutor will create a private, grounded learning path.
            </p>
            <Link href="/app/materials" className={buttonVariants({ variant: "secondary", className: "mt-5" })}>Add material</Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
