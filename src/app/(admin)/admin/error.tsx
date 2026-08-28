"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="min-h-screen bg-muted/50 p-5 sm:p-8 lg:p-10">
      <ErrorFallback
        title="Administration data is unavailable"
        description="No settings were changed. Retry the read-only analytics query or return to the learner app."
        error={error}
        retry={retry}
        returnHref="/app"
        returnLabel="Return to learner app"
      />
    </main>
  );
}
