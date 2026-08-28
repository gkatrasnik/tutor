"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { TutorSource } from "@/lib/tutor/contracts";

export function SourceSheet({
  sessionId,
  messageId,
  count,
}: {
  sessionId: string;
  messageId: string;
  count: number;
}) {
  const [sources, setSources] = useState<
    { label: number; source: TutorSource | null }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError(null);
    setSources(null);
    try {
      const response = await fetch(
        `/api/tutor/sessions/${sessionId}/sources?messageId=${messageId}`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error(
          "Could not load the sources. Close and reopen to retry.",
        );
      setSources(await response.json());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load sources.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      onOpenChange={(open) => {
        if (open) void load();
      }}
    >
      <SheetTrigger
        render={<Button size="sm" variant="ghost" className="mt-2" />}
      >
        Sources ({count})
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Retrieved sources</SheetTitle>
          <SheetDescription>
            Passages supplied to the tutor for this answer. Labels match [1],
            [2], etc. in the response.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          {busy ? <p role="status">Loading sources…</p> : null}
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
          {sources?.map(({ label, source }) => (
            <section key={label} className="rounded-lg border p-4">
              <h3 className="break-words font-medium">
                [{label}] {source?.filename ?? "Source no longer available"}
              </h3>
              {source ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {source.pageNumber
                      ? `Page ${source.pageNumber}`
                      : "Pasted notes"}{" "}
                    · Passage {source.ordinal + 1}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap break-words leading-6">
                    {source.content}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  This material was removed or re-indexed after the answer was
                  saved.
                </p>
              )}
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
