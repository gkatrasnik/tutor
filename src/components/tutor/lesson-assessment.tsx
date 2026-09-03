"use client";

import { GraduationCap } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  COMPLETION_SCORE,
  type AssessmentSummary,
} from "@/lib/assessments/contracts";

export type AssessmentHistory = {
  items: AssessmentSummary[];
  hasMore: boolean;
};

export function LessonAssessment({
  sessionId,
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
  const [passed, setPassed] = useState(initialCompleted);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const submitting = useRef(false);

  async function loadHistory(nextOffset = 0) {
    const response = await fetch(
      `/api/tutor/sessions/${sessionId}/assessments?offset=${nextOffset}`,
      { cache: "no-store" },
    );
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error ?? "Could not load assessments.");
    const saved = result as AssessmentHistory;
    setHistory(saved);
    setOffset(nextOffset);
    if (
      saved.items.some(
        (item) => item.status === "complete" && item.score! >= COMPLETION_SCORE,
      )
    )
      setPassed(true);
  }
  async function refresh(nextOffset = 0) {
    setLoading(true);
    setError(null);
    try {
      await loadHistory(nextOffset);
      await onSaved();
      router.refresh();
    } catch {
      setError("Could not refresh assessment history. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  async function finish() {
    if (submitting.current || disabled || readOnly || !eligible) return;
    submitting.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/tutor/sessions/${sessionId}/assessments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestId: crypto.randomUUID() }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not assess this lesson.");
      setNotice(
        "Assessment saved. If you have not added another completed exchange, your previous result is reused.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Assessment interrupted. Refresh the history before trying again.",
      );
    } finally {
      try {
        await loadHistory();
        await onSaved();
        router.refresh();
      } catch {
        setError(
          "Could not reload the saved result. Refresh the history before trying again.",
        );
      }
      setBusy(false);
      onBusyChange(false);
      submitting.current = false;
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-[0.65rem] bg-play-yellow text-play-yellow-foreground shadow-sm">
              <GraduationCap className="size-5" aria-hidden="true" />
            </span>
            Lesson assessment
          </CardTitle>
          {!readOnly && (passed || initialCompleted) ? (
            <Badge variant="secondary">Lesson complete</Badge>
          ) : null}
          {readOnly ? (
            <Badge variant="outline">Previous course version</Badge>
          ) : null}
        </div>
        <CardDescription>
          Finish when you are ready to assess your understanding. A score of{" "}
          {COMPLETION_SCORE} or higher completes the lesson; a later lower score
          does not undo a pass.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This reviews your own answers from the latest 20 messages in completed
          exchanges. It is an AI estimate, not a formal exam. Keep practicing
          and finish again to save a new attempt.
        </p>
        {!eligible && !readOnly ? (
          <p className="text-sm text-muted-foreground">
            First complete at least two exchanges with the tutor, including an
            explanation in your own words.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              void finish();
            }}
            disabled={disabled || busy || loading || readOnly || !eligible}
          >
            {busy ? "Assessing your understanding…" : "Finish lesson"}
          </Button>
          <Button
            variant="outline"
            disabled={busy || loading || disabled}
            onClick={() => {
              void refresh();
            }}
          >
            Refresh assessments
          </Button>
        </div>
        {busy ? (
          <p role="status" className="text-sm text-muted-foreground">
            Checking the saved conversation against your course sources. Keep
            this page open.
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-primary">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {!history.items.length ? (
          <p className="text-sm text-muted-foreground">
            No assessments yet. Chatting alone does not mark this lesson
            complete.
          </p>
        ) : (
          <>
            <h3 className="text-sm font-semibold">
              Assessment history · Newest first
            </h3>
            <Accordion
              key={history.items
                .map((item) => `${item.id}-${item.status}`)
                .join(",")}
              defaultValue={history.items[0] ? [history.items[0].id] : []}
            >
              {history.items.map((item) => (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger className="gap-3">
                    <span>
                      <time dateTime={item.createdAt}>
                        {item.createdAt.slice(0, 16).replace("T", " ")} UTC
                      </time>
                    </span>
                    <Badge
                      variant={
                        item.status === "failed" ? "destructive" : "secondary"
                      }
                    >
                      {item.status === "complete"
                        ? `${item.score}/100 · ${item.score! >= COMPLETION_SCORE ? "Passed" : "Keep practicing"}`
                        : item.status === "pending"
                          ? "Pending"
                          : "Failed"}
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 py-3">
                    {item.status === "complete" ? (
                      <>
                        <Progress
                          value={item.score!}
                          aria-label={`Mastery estimate: ${item.score} out of 100`}
                        />
                        <Feedback
                          title="Strengths"
                          items={item.strengths}
                          empty="No strengths demonstrated yet in this conversation excerpt."
                        />
                        <Feedback
                          title="Knowledge gaps"
                          items={item.gaps}
                          empty="No specific gaps identified in this excerpt."
                        />
                        <div>
                          <h4 className="font-semibold">
                            Recommended next step
                          </h4>
                          <p className="mt-1 whitespace-pre-wrap break-words leading-6 text-muted-foreground">
                            {item.nextStep}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground">
                        {item.error ??
                          (active
                            ? "Assessment in progress. Refresh shortly."
                            : "This attempt was interrupted. Finish the lesson again to retry.")}
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <div className="flex gap-2">
              {offset > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || loading}
                  onClick={() => {
                    void refresh(Math.max(0, offset - 20));
                  }}
                >
                  Newer assessments
                </Button>
              ) : null}
              {history.hasMore ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || loading}
                  onClick={() => {
                    void refresh(offset + 20);
                  }}
                >
                  Older assessments
                </Button>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Feedback({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div>
      <h4 className="font-semibold">{title}</h4>
      {items.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 leading-6 text-muted-foreground">
          {items.map((text, index) => (
            <li key={index} className="break-words">
              {text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
