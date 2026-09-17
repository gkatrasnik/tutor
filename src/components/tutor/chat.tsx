"use client";

import { MessageCircleQuestion } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage } from "@/lib/tutor/contracts";
import { readTutorStream } from "@/lib/tutor/read-stream";
import { SourceSheet } from "./source-sheet";
import { LessonAssessment, type AssessmentHistory } from "./lesson-assessment";

type TutorRequest = {
  requestId: string;
  message: string;
  action: "message" | "continue";
  expectedSequence: number;
  expectedStep: number;
};

export function TutorChat({
  sessionId,
  initialMessages,
  initialSequence,
  courseId,
  nextLesson,
  initialLessonProgress,
  initiallyReadOnly,
  initiallyActive,
  initialAssessments,
  initialCompleted,
}: {
  sessionId: string;
  initialMessages: ChatMessage[];
  initialSequence: number;
  courseId: string;
  nextLesson: { id: string; title: string } | null;
  initialLessonProgress: {
    total: number;
    completed: number;
    ready: boolean;
    awaitingContinue?: boolean;
  };
  initiallyReadOnly: boolean;
  initiallyActive: boolean;
  initialAssessments: AssessmentHistory;
  initialCompleted: boolean;
}) {
  const [sequence, setSequence] = useState(initialSequence);
  const [pending, setPending] = useState<TutorRequest | null>(null);
  const [progress, setProgress] = useState(initialLessonProgress);
  const [messages, setMessages] = useState(initialMessages);
  const [readOnly, setReadOnly] = useState(initiallyReadOnly);
  const [active, setActive] = useState(initiallyActive);
  const [busy, setBusy] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const resumedLegacyStep = useRef<string | null>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const previousLastMessageId = useRef(initialMessages.at(-1)?.id);
  useEffect(() => {
    const lastMessageId = messages.at(-1)?.id;
    const hasNewSavedMessage = lastMessageId !== previousLastMessageId.current;
    previousLastMessageId.current = lastMessageId;
    if (!busy && !hasNewSavedMessage) return;

    const frame = requestAnimationFrame(() => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        const container = conversation.current;
        container?.scrollTo({ top: container.scrollHeight });
      } else {
        end.current?.scrollIntoView({ block: "end" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [answer, busy, messages]);

  async function refresh(request = pending) {
    const response = await fetch(`/api/tutor/sessions/${sessionId}`, {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error ?? "Could not refresh the conversation.");
    setMessages(result.messages);
    setReadOnly(result.readOnly);
    setActive(result.active);
    setProgress(result.lessonProgress);
    setSequence(result.nextSequence);
    if (request) {
      const reply = (result.messages as ChatMessage[]).find(
        (message) =>
          message.role === "assistant" &&
          message.requestId === request.requestId,
      );
      if (reply?.status === "complete") {
        setPending(null);
        if (request.action === "message") setDraft("");
        setError(null);
      } else if (!reply && result.nextSequence !== request.expectedSequence) {
        setPending(null);
        setDraft("");
        setError(
          "The lesson changed. Read the latest tutor message before answering.",
        );
      } else if (
        reply?.status === "failed" ||
        (reply?.status === "pending" && !result.active)
      ) {
        setPending(null);
        if (request.action === "message") setDraft(request.message);
      }
    }
  }
  async function send(
    text: string,
    action: TutorRequest["action"] = "message",
    retry?: TutorRequest,
  ) {
    if (
      sending.current ||
      assessing ||
      active ||
      readOnly ||
      (pending && !retry) ||
      !text.trim()
    )
      return;
    const request = retry ?? {
      requestId: crypto.randomUUID(),
      message: text.trim(),
      action,
      expectedSequence: sequence,
      expectedStep: progress.total ? progress.completed : -1,
    };
    setPending(request);
    sending.current = true;
    setBusy(true);
    setError(null);
    setQuestion(text.trim());
    setAnswer("");
    if (request.action === "message") setDraft("");
    try {
      const response = await fetch(
        `/api/tutor/sessions/${sessionId}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "The tutor could not start.");
      }
      if (!response.body) throw new Error("The response stream is missing.");
      await readTutorStream(response.body, (event) => {
        if (event.type === "delta")
          setAnswer((current) => current + event.text);
        if (event.type === "replace") setAnswer(event.text);
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The response was interrupted.",
      );
      // Keep this request ID until its saved outcome is known.
    } finally {
      try {
        await refresh(request);
      } catch {
        setError(
          "Could not reload the saved conversation. Refresh before resending your question.",
        );
      }
      setQuestion("");
      setAnswer("");
      setBusy(false);
      sending.current = false;
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  // Resume sessions saved by the old manual-Continue workflow once per step.
  const resumeLegacyStep = useEffectEvent(
    () => void send("Continue", "continue"),
  );
  useEffect(() => {
    const key = `${sessionId}:${sequence}`;
    if (
      progress.awaitingContinue &&
      !busy &&
      !active &&
      !assessing &&
      !readOnly &&
      !pending &&
      resumedLegacyStep.current !== key
    ) {
      resumedLegacyStep.current = key;
      resumeLegacyStep();
    }
  }, [
    sessionId,
    sequence,
    progress.awaitingContinue,
    busy,
    active,
    assessing,
    readOnly,
    pending,
  ]);

  return (
    <div className="mt-6 space-y-5">
      {readOnly ? (
        <p className="rounded-xl border bg-warning/10 p-4 text-sm">
          This conversation is read-only because its course sources or outline
          changed. Open the course to start a current lesson.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Saved conversation · Latest 100 messages · 30 tutor turns per UTC day
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || assessing}
          onClick={() => {
            void refresh().catch(() =>
              setError("Could not refresh. Please try again."),
            );
          }}
        >
          Refresh conversation
        </Button>
      </div>
      {!progress.total && !busy ? (
        <Card>
          <CardContent className="flex items-start gap-4 p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[0.65rem] bg-play-orange text-white shadow-sm">
              <MessageCircleQuestion className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">
                Learn one small part at a time and answer a short question after
                each explanation. Then take a multiple-choice test.
              </p>
              <Button
                disabled={readOnly || active || !!pending}
                onClick={() => {
                  void send("Begin lesson");
                }}
              >
                Begin lesson
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {messages.length > 0 || busy ? (
        <div
          ref={conversation}
          role="region"
          aria-label="Conversation"
          tabIndex={0}
          className="max-h-none space-y-4 overflow-visible md:max-h-[60vh] md:overflow-y-auto md:rounded-xl md:border md:p-4 md:pr-3 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {messages.map((message) => (
            <Card
              key={message.id}
              className={
                message.role === "user" ? "ml-6" : "mr-6 bg-tutor-bubble"
              }
            >
              <CardContent className="p-5">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <span
                    className={`size-2 rounded-full ${message.role === "user" ? "bg-primary" : "bg-play-blue"}`}
                    aria-hidden="true"
                  />
                  {message.role === "user" ? "You" : "Tutor"}
                </p>
                <p className="whitespace-pre-wrap break-words leading-7">
                  {message.content}
                </p>
                {message.status === "failed" ? (
                  <p className="text-sm text-destructive">{message.error}</p>
                ) : null}
                {message.status === "pending" ? (
                  <p className="text-sm text-muted-foreground">
                    {active
                      ? "Response is processing. Refresh shortly."
                      : "This response was interrupted. You can send your question again."}
                  </p>
                ) : null}
                {message.role === "assistant" &&
                message.status === "complete" &&
                message.sourceCount > 0 ? (
                  <SourceSheet
                    sessionId={sessionId}
                    messageId={message.id}
                    count={message.sourceCount}
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}
          {busy ? (
            <>
              <Card className="ml-6">
                <CardContent className="p-5">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span
                      className="size-2 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    You
                  </p>
                  <p className="whitespace-pre-wrap break-words">{question}</p>
                </CardContent>
              </Card>
              <Card className="mr-6 bg-tutor-bubble">
                <CardContent className="p-5">
                  <p
                    className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"
                    role="status"
                  >
                    <span
                      className="size-2 rounded-full bg-play-blue"
                      aria-hidden="true"
                    />
                    Tutor is responding…
                  </p>
                  <p className="whitespace-pre-wrap break-words leading-7">
                    {answer}
                  </p>
                </CardContent>
              </Card>
            </>
          ) : null}
          <div ref={end} />
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      {active && !busy ? (
        <p role="status" className="text-sm text-muted-foreground">
          A response or assessment is running. Refresh shortly; interrupted
          attempts unlock after two minutes.
        </p>
      ) : null}
      {progress.total > 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {progress.completed} of {progress.total} lesson parts completed
          {progress.ready ? " · Ready for the test" : ""}
        </p>
      ) : null}
      {pending && !busy ? (
        <div role="status" className="space-y-2 rounded-lg border p-4 text-sm">
          <p>
            Checking whether your reply was saved. Your lesson will not advance
            twice.
          </p>
          <Button
            variant="outline"
            disabled={assessing || readOnly}
            onClick={() => {
              void refresh().catch(() =>
                setError(
                  "Could not check the reply. Try again when connected.",
                ),
              );
            }}
          >
            Check reply
          </Button>
          {!active ? (
            <Button
              variant="outline"
              disabled={assessing || readOnly}
              onClick={() => {
                void send(pending.message, pending.action, pending);
              }}
            >
              Retry reply
            </Button>
          ) : null}
        </div>
      ) : null}
      {progress.total > 0 ? (
        <form onSubmit={submit} className="space-y-3">
          <Label htmlFor="tutor-message">
            {progress.ready ? "Review the lesson" : "Your message"}
          </Label>
          <Textarea
            id="tutor-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={2000}
            disabled={busy || assessing || active || readOnly || !!pending}
            placeholder={
              progress.ready || progress.awaitingContinue
                ? "Ask about anything you want to understand better…"
                : "Answer or ask for an explanation…"
            }
            className="min-h-28"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {draft.length}/2,000 · Enter to send · Shift + Enter for a new
              line · Source-grounded AI can still make mistakes.
            </p>
            <Button
              type="submit"
              disabled={
                busy ||
                assessing ||
                active ||
                readOnly ||
                !!pending ||
                !draft.trim()
              }
            >
              {busy ? "Responding…" : "Send"}
            </Button>
          </div>
        </form>
      ) : null}
      <LessonAssessment
        sessionId={sessionId}
        initialHistory={initialAssessments}
        courseId={courseId}
        nextLesson={nextLesson}
        initialCompleted={initialCompleted}
        disabled={busy || !!pending}
        readOnly={readOnly}
        active={active}
        eligible={!active && progress.ready}
        onBusyChange={setAssessing}
        onSaved={() => refresh()}
      />
    </div>
  );
}
