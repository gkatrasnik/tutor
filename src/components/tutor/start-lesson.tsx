"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function StartLesson({
  lessonId,
  disabled,
}: {
  lessonId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/lessons/${lessonId}/session`, {
        method: "POST",
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id)
        throw new Error(result.error ?? "Could not open the lesson.");
      router.push(`/app/sessions/${result.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not open the lesson.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-2">
      <Button size="sm" onClick={start} disabled={disabled || busy}>
        {busy ? "Opening…" : "Start / resume lesson"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
