"use client";

import Link from "next/link";
import { StartLesson } from "./start-lesson";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Wizard } from "@/components/ui/wizard";
import {
  COMPLETION_SCORE,
  type AssessmentSummary,
  type PublicQuiz,
  type QuizReview,
} from "@/lib/assessments/contracts";

export type AssessmentHistory = {
  items: AssessmentSummary[];
  hasMore: boolean;
};

export function LessonAssessment({
  sessionId,
  courseId,
  nextLesson,
  initialHistory,
  initialCompleted,
  disabled,
  readOnly,
  active,
  eligible,
  onBusyChange,
  onSaved,
}: {
  sessionId: string;
  courseId?: string;
  nextLesson?: { id: string; title: string } | null;
  initialHistory: AssessmentHistory;
  initialCompleted: boolean;
  disabled: boolean;
  readOnly: boolean;
  active: boolean;
  eligible: boolean;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const router = useRouter();
  const [history, setHistory] = useState(initialHistory);
  const [offset, setOffset] = useState(0);
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    score: number;
    correct: number;
    total: number;
    passed: boolean;
    review: QuizReview;
  } | null>(null);
  const submitting = useRef(false);
  const url = `/api/tutor/sessions/${sessionId}/assessments`;
  const passed =
    initialCompleted ||
    result?.passed ||
    history.items.some(
      (item) =>
        item.status === "complete" &&
        item.score! >= (item.passingScore ?? COMPLETION_SCORE),
    );
  const locked = disabled || readOnly || active || busy;

  async function loadHistory(nextOffset = 0) {
    const response = await fetch(`${url}?offset=${nextOffset}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error ?? "Could not load test history.");
    setHistory(data);
    setOffset(nextOffset);
  }
  async function run(action: () => Promise<void>) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    onBusyChange(true);
    try {
      await action();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save the test. Try again.",
      );
    } finally {
      setBusy(false);
      onBusyChange(false);
      submitting.current = false;
    }
  }
  async function start() {
    if (locked || !eligible) return;
    await run(async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID() }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not create the test.");
      const next = data as PublicQuiz;
      setQuiz(next);
      setAnswers(next.questions.map(() => null));
      setStep(0);
      setResult(null);
    });
  }
  function selectAnswer(index: number) {
    setAnswers((current) =>
      current.map((answer, position) => (position === step ? index : answer)),
    );
    if (quiz && step < quiz.questions.length - 1) setStep(step + 1);
  }
  async function finish() {
    if (!quiz || locked || answers.some((answer) => answer === null)) return;
    await run(async () => {
      const response = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assessmentId: quiz.id, answers }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ??
            "Could not submit the test. Your answers are kept; try again.",
        );
      setResult(data);
      setQuiz(null);
      await loadHistory();
      await onSaved();
      router.refresh();
    });
  }
  const question = quiz?.questions[step];
  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Lesson test</CardTitle>
          {readOnly ? (
            <Badge variant="outline">Previous course version</Badge>
          ) : passed ? (
            <Badge variant="secondary">Lesson complete</Badge>
          ) : null}
        </div>
        <CardDescription>
          Answer 3–6 multiple-choice questions. At least {COMPLETION_SCORE}%
          correct passes the test. Your answers are graded together when you
          complete the test.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!eligible && !readOnly ? (
          <p className="text-sm text-muted-foreground">
            Answer the short question for every lesson part to enable the test.
          </p>
        ) : null}
        {quiz && question ? (
          <Wizard
            step={step}
            total={quiz.questions.length}
            onStepChange={setStep}
            busy={locked}
            canContinue={
              answers[step] !== null &&
              (step < quiz.questions.length - 1 ||
                answers.every((answer) => answer !== null))
            }
            onComplete={() => {
              void finish();
            }}
          >
            <fieldset disabled={locked} className="space-y-3">
              <legend className="mb-4 font-medium">{question.question}</legend>
              {question.options.map((option, index) => (
                <label
                  key={index}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-checked:border-primary has-checked:bg-primary/5"
                >
                  <input
                    type="radio"
                    name={`question-${step}`}
                    value={index}
                    checked={answers[step] === index}
                    onChange={() => selectAnswer(index)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold">{"ABCD"[index]}.</span>{" "}
                    {answerText(option)}
                  </span>
                </label>
              ))}
            </fieldset>
          </Wizard>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={passed ? "outline" : "default"}
              disabled={locked || !eligible}
              onClick={() => {
                void start();
              }}
            >
              {busy
                ? "Preparing test…"
                : !readOnly && passed
                  ? "Test again"
                  : result && !result.passed
                    ? "Retake test"
                    : "Test"}
            </Button>
          </div>
        )}
        {!quiz && passed && !readOnly ? (
          nextLesson ? (
            <StartLesson
              lessonId={nextLesson.id}
              disabled={locked}
              label="Next lesson"
            />
          ) : courseId ? (
            <Link
              href={`/app/courses/${courseId}`}
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Back to course
            </Link>
          ) : null
        ) : null}
        {result ? (
          <div role="status" className="rounded-lg border p-4">
            <p className="font-semibold">
              {result.passed ? "Test passed" : "Test not passed"} ·{" "}
              {result.correct}/{result.total} correct ({result.score}%)
            </p>
            <p className="mt-2 text-sm">
              {result.passed
                ? nextLesson
                  ? "You can continue to the next lesson."
                  : "Lesson passed. Return to your course to see your progress."
                : "Review the lesson and take the test again whenever you are ready."}
            </p>
            <AnswerReview review={result.review} />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {!quiz && !history.items.length ? (
          <p className="text-sm text-muted-foreground">No tests yet.</p>
        ) : null}
        {!quiz && history.items.length ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">
              Test history · Newest first
            </h3>
            {history.items.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <p>
                  {item.createdAt.slice(0, 16).replace("T", " ")} UTC ·{" "}
                  {item.status === "complete"
                    ? `${item.score}% · ${item.score! >= (item.passingScore ?? COMPLETION_SCORE) ? "Passed" : "Not passed"}`
                    : item.status === "failed"
                      ? "Failed"
                      : item.quiz
                        ? "Ready — press Test to resume"
                        : "Preparing"}
                </p>
                {item.review ? <AnswerReview review={item.review} /> : null}
                {item.nextStep || item.error ? (
                  <p className="mt-2 text-muted-foreground">
                    {item.error ?? item.nextStep}
                  </p>
                ) : null}
              </div>
            ))}
            <div className="flex gap-2">
              {offset > 0 ? (
                <Button
                  variant="outline"
                  disabled={locked}
                  onClick={() => {
                    void run(() => loadHistory(Math.max(0, offset - 20)));
                  }}
                >
                  Newer tests
                </Button>
              ) : null}
              {history.hasMore ? (
                <Button
                  variant="outline"
                  disabled={locked}
                  onClick={() => {
                    void run(() => loadHistory(offset + 20));
                  }}
                >
                  Older tests
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AnswerReview({ review }: { review: QuizReview | undefined }) {
  if (!review) return null;
  return (
    <details className="mt-4">
      <summary className="cursor-pointer font-medium">Review answers</summary>
      <ol className="mt-3 space-y-4">
        {review.map((item, index) => (
          <li key={index} className="rounded-lg border p-3">
            <p className="font-medium">
              {index + 1}. {item.question}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <span>
                Your answer: {"ABCD"[item.selectedOption]}.{" "}
                {answerText(item.options[item.selectedOption])}
              </span>
              <Badge
                variant={
                  item.selectedOption === item.correctOption
                    ? "secondary"
                    : "destructive"
                }
                className={
                  item.selectedOption === item.correctOption
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : undefined
                }
              >
                {item.selectedOption === item.correctOption
                  ? "Correct"
                  : "Incorrect"}
              </Badge>
            </p>
            {item.selectedOption !== item.correctOption ? (
              <p>
                Correct answer: {"ABCD"[item.correctOption]}.{" "}
                {answerText(item.options[item.correctOption])}
              </p>
            ) : null}
            <p className="mt-2 text-muted-foreground">{item.explanation}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}

function answerText(option: string) {
  return option.replace(/^\s*[A-D][.)]\s+/i, "");
}
