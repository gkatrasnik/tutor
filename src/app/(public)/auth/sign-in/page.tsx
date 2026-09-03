import { ArrowLeft, LockKeyhole, MailCheck } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-12">
      <div
        className="pointer-events-none absolute left-[8%] top-[12%] size-12 rounded-full bg-play-blue/70"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[10%] top-[18%] hidden size-14 rotate-12 rounded-sm bg-play-orange/70 sm:block"
        aria-hidden="true"
      />
      <div
        className="dot-grid pointer-events-none absolute bottom-[12%] left-[12%] hidden size-20 text-play-yellow/55 sm:block"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-[15%] right-[8%] hidden h-3 w-24 -rotate-6 rounded-sm bg-primary/45 sm:block"
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Brand className="text-lg" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Home
            </Link>
          </div>
        </div>

        <Card className="border-border bg-card shadow-xl">
          <CardHeader className="text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-[0.75rem] bg-play-blue text-white shadow-sm">
              <MailCheck className="size-5" aria-hidden="true" />
            </span>
            <CardTitle className="text-2xl tracking-tight">
              <h1>Welcome to Tutor</h1>
            </CardTitle>
            <CardDescription className="text-sm leading-6">
              Sign in to continue learning from your private material.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>This sign-in link is no longer valid</AlertTitle>
                <AlertDescription>
                  Request a fresh link below and use the newest email.
                </AlertDescription>
              </Alert>
            )}
            <SignInForm />
            <div className="flex items-start gap-2 border-t pt-5 text-xs leading-5 text-muted-foreground">
              <LockKeyhole
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              Your session uses a signed, HTTP-only cookie. Your learning
              material stays private.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
