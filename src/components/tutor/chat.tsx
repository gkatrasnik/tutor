"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage } from "@/lib/tutor/contracts";
import { readTutorStream } from "@/lib/tutor/read-stream";
import { SourceSheet } from "./source-sheet";
import { LessonAssessment, type AssessmentHistory } from "./lesson-assessment";

export function TutorChat({
  sessionId,
  initialMessages,
  initiallyReadOnly,
  initiallyActive,
  initialAssessments,
  initialCompleted,
}: {
  sessionId: string;
  initialMessages: ChatMessage[];
  initiallyReadOnly: boolean;
  initiallyActive: boolean;
  initialAssessments: AssessmentHistory;
  initialCompleted: boolean;
}) {
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
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (busy) end.current?.scrollIntoView({ block: "nearest" });
  }, [answer, busy]);

  async function refresh() {
    const response = await fetch(`/api/tutor/sessions/${sessionId}`, {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error ?? "Could not refresh the conversation.");
    setMessages(result.messages);
    setReadOnly(result.readOnly);
    setActive(result.active);
  }
  async function send(text: string) {
    if (sending.current || assessing || active || readOnly || !text.trim())
      return;
    sending.current = true;
    setBusy(true);
    setError(null);
    setQuestion(text.trim());
    setAnswer("");
    setDraft("");
    try {
      const response = await fetch(
        `/api/tutor/sessions/${sessionId}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            message: text.trim(),
          }),
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
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The response was interrupted.",
      );
      setDraft(text);
    } finally {
      try {
        await refresh();
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

  return (
    <div className="mt-6 space-y-5">
      {readOnly ? (
        <p className="rounded-xl border bg-amber-50 p-4 text-sm">
          This conversation is read-only because its course sources or outline
          changed. Open the course to start a current lesson.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
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
      {!messages.length && !busy ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm leading-6 text-stone-600">
              Your tutor will introduce one idea at a time and help you reason
              through it. You can ask a question or start with a short
              introduction.
            </p>
            <Button
              disabled={readOnly || active}
              onClick={() => {
                void send(
                  "Please introduce this lesson and ask me an opening question.",
                );
              }}
            >
              Begin lesson
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <div className="space-y-4" aria-label="Conversation">
        {messages.map((message) => (
          <Card
            key={message.id}
            className={
              message.role === "user" ? "ml-6 bg-emerald-50" : "mr-6 bg-white"
            }
          >
            <CardContent className="p-5">
              <p className="mb-2 text-xs font-semibold text-stone-500">
                {message.role === "user" ? "You" : "Tutor"}
              </p>
              <p className="whitespace-pre-wrap break-words leading-7">
                {message.content}
              </p>
              {message.status === "failed" ? (
                <p className="text-sm text-red-700">{message.error}</p>
              ) : null}
              {message.status === "pending" ? (
                <p className="text-sm text-stone-500">
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
            <Card className="ml-6 bg-emerald-50">
              <CardContent className="whitespace-pre-wrap break-words p-5">
                {question}
              </CardContent>
            </Card>
            <Card className="mr-6">
              <CardContent className="p-5">
                <p className="mb-2 text-xs text-stone-500" role="status">
                  Tutor is responding… Not saved yet.
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
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
      {active && !busy ? (
        <p role="status" className="text-sm text-stone-500">
          A response or assessment is running. Refresh shortly; interrupted
          attempts unlock after two minutes.
        </p>
      ) : null}
      <form onSubmit={submit} className="space-y-3">
        <Label htmlFor="tutor-message">Your answer or question</Label>
        <Textarea
          id="tutor-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          disabled={busy || assessing || active || readOnly}
          placeholder="Tell the tutor what you think, or ask for a hint…"
          className="min-h-28"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-stone-500">
            {draft.length}/2,000 · Source-grounded AI can still make mistakes.
          </p>
          <Button
            type="submit"
            disabled={busy || assessing || active || readOnly || !draft.trim()}
          >
            {busy ? "Responding…" : "Send"}
          </Button>
        </div>
      </form>
      <LessonAssessment
        sessionId={sessionId}
        initialHistory={initialAssessments}
        initialCompleted={initialCompleted}
        disabled={busy}
        readOnly={readOnly}
        active={active}
        eligible={
          !active &&
          messages.filter(
            (message) =>
              message.role === "assistant" && message.status === "complete",
          ).length >= 2
        }
        onBusyChange={setAssessing}
        onSaved={refresh}
      />
    </div>
  );
}
