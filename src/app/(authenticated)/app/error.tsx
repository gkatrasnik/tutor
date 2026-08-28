"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10">
      <ErrorFallback
        title="We couldn't load this page"
        description="The problem may be temporary. Try loading the page again; your saved courses and conversations are unchanged."
        error={error}
        retry={retry}
        returnHref="/app"
        returnLabel="Return to courses"
      />
    </main>
  );
}
