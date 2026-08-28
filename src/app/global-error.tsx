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
      <body className="min-h-screen bg-stone-50 text-stone-950 antialiased">
        <main className="flex min-h-screen items-center justify-center p-5">
          <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <title>Something went wrong | Tutor</title>
            <p className="text-sm font-medium text-red-700">Unexpected error</p>
            <h1 className="mt-2 text-2xl font-semibold">Tutor couldn’t load</h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Try again. If the problem continues, return to the home page and
              start a new navigation.
            </p>
            {error.digest ? (
              <p className="mt-3 text-xs text-stone-500">
                Reference: <code>{error.digest}</code>
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => retry()}
                className="inline-flex h-8 items-center justify-center rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex h-8 items-center justify-center rounded-lg border border-stone-200 px-3 text-sm font-medium hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700"
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
