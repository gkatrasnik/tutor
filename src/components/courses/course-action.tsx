"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";

export function CourseAction({
  courseId,
  status,
  outdated = false,
  disabled = false,
}: {
  courseId: string;
  status?: "pending" | "generating" | "ready" | "failed";
  outdated?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/outline`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        id?: string;
        status?: string;
        error?: string;
      };
      if (!response.ok || !result.id)
        throw new Error(
          result.error ?? "The outline could not be generated. Please retry.",
        );
      if (result.status === "ready")
        toast.success("Your course outline is ready.");
      else toast.info("Your outline is still generating. Check again shortly.");
      router.push(`/app/courses/${result.id}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The outline could not be generated. Please retry.",
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (status === "ready" && !outdated) {
    return (
      <Link
        href={`/app/courses/${courseId}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        View outline
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={generate}
        disabled={busy || disabled}
      >
        {busy ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : null}
        {busy
          ? "Generating outline…"
          : status === "generating"
            ? "Check generation"
            : status === "failed"
              ? "Retry outline"
              : outdated
                ? "Update outline"
                : "Generate outline"}
      </Button>
      {busy ? (
        <p className="text-xs text-stone-500" role="status">
          This can take up to two minutes. Keep this page open.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
