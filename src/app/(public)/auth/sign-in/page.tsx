import { ArrowLeft, LockKeyhole, MailCheck } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/brand";
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fbfcf9] px-5 py-12">
      <div className="pointer-events-none absolute -left-40 top-0 size-[30rem] rounded-full bg-emerald-100/70 blur-3xl" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Brand className="text-lg" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Home
          </Link>
        </div>

        <Card className="border-stone-200 bg-white shadow-[0_24px_80px_-32px_rgba(28,44,36,0.3)]">
          <CardHeader className="text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
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
            <div className="flex items-start gap-2 border-t pt-5 text-xs leading-5 text-stone-500">
              <LockKeyhole
                className="mt-0.5 size-3.5 shrink-0 text-emerald-700"
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
