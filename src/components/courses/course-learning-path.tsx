import { BookOpenCheck } from "lucide-react";
import { StartLesson } from "@/components/tutor/start-lesson";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { courseProgress } from "@/lib/assessments/contracts";

type Lesson = {
  id: string;
  ordinal: number;
  title: string;
  objective: string;
  concepts: string[];
};

export function CourseLearningPath({
  title,
  lessons,
  completedIds,
  disabled,
  outdated,
  tutorTurnsRemaining,
}: {
  title: string;
  lessons: Lesson[];
  completedIds: string[];
  disabled: boolean;
  outdated: boolean;
  tutorTurnsRemaining: number;
}) {
  const completed = new Set(completedIds);
  const progress = courseProgress(
    lessons.length,
    lessons.filter((lesson) => completed.has(lesson.id)).length,
  );
  const nextLesson =
    lessons.find((lesson) => !completed.has(lesson.id)) ?? lessons[0];

  return (
    <section className="mt-6" aria-label="Lessons">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.65rem] bg-primary text-primary-foreground shadow-sm">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </span>
            <h2>{title}</h2>
          </CardTitle>
          <CardDescription>
            {progress.completed === progress.total
              ? "All lessons complete. You can revisit any lesson to keep practicing."
              : "Pick up where you left off, or choose another lesson."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-muted-foreground">
            {progress.completed} of {progress.total} lessons completed ·{" "}
            {progress.percent}%
          </p>
          <Progress
            value={progress.percent}
            aria-label={`${progress.completed} of ${progress.total} lessons completed`}
          />
          {outdated ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Update the outline before starting or resuming lessons. Previous
              assessments remain in conversation history.
            </p>
          ) : null}
          {tutorTurnsRemaining === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground" role="status">
              Today’s tutor turn allowance is used up. You can review saved
              conversations; new tutor responses are available after 00:00 UTC.
            </p>
          ) : null}
          <Accordion
            className="mt-5"
            defaultValue={nextLesson ? [nextLesson.id] : []}
          >
            {lessons.map((lesson) => (
              <AccordionItem key={lesson.id} value={lesson.id}>
                <AccordionTrigger className="gap-4 py-5">
                  <span className="font-mono text-play-blue-foreground">
                    {String(lesson.ordinal + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1">{lesson.title}</span>
                  {completed.has(lesson.id) ? (
                    <Badge variant="secondary">Complete</Badge>
                  ) : null}
                </AccordionTrigger>
                <AccordionContent className="pb-5 pl-8">
                  <p className="leading-6 text-muted-foreground">
                    {lesson.objective}
                  </p>
                  <div
                    className="mt-3 flex flex-wrap gap-2"
                    aria-label="Key concepts"
                  >
                    {lesson.concepts.map((concept, index) => (
                      <Badge
                        key={`${index}-${concept}`}
                        variant="secondary"
                        className="h-auto whitespace-normal text-left"
                      >
                        {concept}
                      </Badge>
                    ))}
                  </div>
                  <StartLesson lessonId={lesson.id} disabled={disabled} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
      <p className="mt-4 text-sm text-muted-foreground">
        Use Finish lesson in the conversation to assess your understanding. A
        saved score of 70 or higher completes that lesson.
      </p>
    </section>
  );
}
