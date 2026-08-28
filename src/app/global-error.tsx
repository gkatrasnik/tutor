"use client";

import Link from "next/link";

import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-muted/50 text-foreground antialiased">
        <main className="flex min-h-screen items-center justify-center p-5">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
            <title>Something went wrong | Tutor</title>
            <p className="text-sm font-medium text-destructive">
              Unexpected error
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Tutor couldn’t load</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Try again. If the problem continues, return to the home page and
              start a new navigation.
            </p>
            {error.digest ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Reference: <code>{error.digest}</code>
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => retry()}
                className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Return home
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
