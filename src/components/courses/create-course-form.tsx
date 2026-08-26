"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateCourseForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/courses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name") }) });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "Could not create your course.");
      router.push(`/app/courses/${result.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create your course.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create} className="space-y-3">
      <Label htmlFor="course-name">Course name</Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input id="course-name" name="name" required maxLength={160} placeholder="e.g. Biology exam preparation" disabled={busy} />
        <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create course"}</Button>
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
