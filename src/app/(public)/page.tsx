import {
  ArrowRight,
  BookMarked,
  BrainCircuit,
  Check,
  LockKeyhole,
  MessageCircleQuestion,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { AccountMenu } from "@/components/account-menu";
import { Brand } from "@/components/brand";
import { PublicHeader } from "@/components/public-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isAdminEmail } from "@/lib/auth/authorization";
import { getOptionalUser } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const steps = [
  {
    icon: BookMarked,
    title: "Bring your material",
    body: "Upload a private PDF or paste the text you actually need to understand.",
    surfaceTone: "bg-primary/8 hover:bg-primary/12",
    iconTone: "bg-primary text-primary-foreground",
  },
  {
    icon: BrainCircuit,
    title: "Get a focused course",
    body: "Tutor finds the important ideas and turns them into a practical lesson path.",
    surfaceTone: "bg-play-blue/8 hover:bg-play-blue/12",
    iconTone: "bg-play-blue text-white",
  },
  {
    icon: MessageCircleQuestion,
    title: "Learn by thinking",
    body: "Work through one question at a time with explanations grounded in your source.",
    surfaceTone: "bg-play-orange/8 hover:bg-play-orange/12",
    iconTone: "bg-play-orange text-white",
  },
];

const lessons = [
  {
    number: "01",
    title: "Why attention is selective",
    detail: "Complete",
    state: "complete",
  },
  {
    number: "02",
    title: "Working memory under load",
    detail: "12 min",
    state: "active",
  },
  {
    number: "03",
    title: "Designing for deep focus",
    detail: "18 min",
    state: "upcoming-yellow",
  },
  {
    number: "04",
    title: "Build a sustainable practice",
    detail: "15 min",
    state: "upcoming-orange",
  },
];

export default async function LandingPage() {
  const user = await getOptionalUser();
  const displayName = user?.name?.trim() || user?.email || "";
  const initials = displayName
    .split(/\s+|@/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <PublicHeader>
        {user ? (
          <>
            <Link
              href="/app"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "hidden sm:inline-flex",
              )}
            >
              My courses
            </Link>
            <AccountMenu
              displayName={displayName}
              email={user.email}
              initials={initials}
              showAdmin={isAdminEmail(user.email, env.ADMIN_EMAILS)}
            />
          </>
        ) : (
          <>
            <ThemeToggle />
            <Link
              href="/auth/sign-in"
              className={buttonVariants({ variant: "outline" })}
            >
              Sign in
            </Link>
          </>
        )}
      </PublicHeader>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:pb-32 lg:pt-24">
        <div
          className="pointer-events-none absolute left-6 top-5 size-5 rounded-full bg-play-blue/85 lg:left-[4%] lg:top-12 lg:size-9"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-7 top-6 size-6 rotate-12 rounded-sm bg-play-orange lg:right-[3%] lg:top-16 lg:size-12"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-8 left-6 h-6 w-12 rounded-t-full bg-play-yellow/75 lg:bottom-14 lg:left-[47%] lg:h-14 lg:w-28"
          aria-hidden="true"
        />
        <div
          className="dot-grid pointer-events-none absolute right-[43%] top-4 size-8 text-primary/55 xl:top-24 xl:size-20"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-10 right-7 h-2 w-14 -rotate-6 rounded-sm bg-play-blue/80 lg:bottom-16 lg:right-[5%] lg:h-3 lg:w-24"
          aria-hidden="true"
        />

        <div className="relative z-10">
          <Badge
            variant="outline"
            className="mb-6 border-primary/25 bg-card px-3 py-1 text-primary shadow-sm"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            Your material. Your pace.
          </Badge>
          <h1 className="text-balance max-w-3xl text-5xl font-bold leading-[1.02] tracking-[-0.045em] text-foreground sm:text-6xl lg:text-7xl">
            Stop rereading.{" "}
            <span className="text-primary">Start understanding.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
            Tutor transforms the material in front of you into a clear course,
            then helps you reason through it with questions built around what
            you need next.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href={user ? "/app" : "/auth/sign-in"}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 px-5 text-base",
              )}
            >
              {user ? "Go to my courses" : "Create your first course"}
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              href="#how-it-works"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 px-5 text-base",
              )}
            >
              See how it works
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <LockKeyhole className="size-4 text-primary" aria-hidden="true" />
            Private by design
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-lg lg:mx-0">
          <div
            className="pointer-events-none absolute -left-2 -top-3 size-9 rounded-full bg-play-blue/45 sm:-left-5 sm:-top-5 sm:size-14"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-3 -right-2 size-8 rotate-12 rounded-sm bg-play-orange/55 sm:-bottom-5 sm:-right-4 sm:size-12"
            aria-hidden="true"
          />
          <Card className="relative overflow-hidden border-border/80 bg-card py-0 shadow-xl">
            <div className="border-b bg-muted/70 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-play-blue-foreground">
                    Your course
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight">
                    The science of attention
                  </h2>
                </div>
                <Badge className="bg-primary/10 text-primary">4 lessons</Badge>
              </div>
            </div>
            <CardContent className="space-y-3 p-4 sm:p-6">
              {lessons.map((lesson) => (
                <div
                  key={lesson.number}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border p-4 transition-transform hover:-translate-y-0.5",
                    lesson.state === "active"
                      ? "border-play-blue/30 bg-play-blue/10"
                      : "border-border/70 bg-background/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-[0.65rem] text-xs font-bold",
                      lesson.state === "complete"
                        ? "bg-primary text-primary-foreground"
                        : lesson.state === "active"
                          ? "bg-play-blue/15 text-play-blue-foreground"
                          : lesson.state === "upcoming-orange"
                            ? "bg-play-orange/15 text-play-orange-foreground"
                            : "bg-play-yellow/20 text-play-yellow-foreground",
                    )}
                  >
                    {lesson.state === "complete" ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      lesson.number
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {lesson.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {lesson.detail}
                    </p>
                  </div>
                  {lesson.state === "active" ? (
                    <ArrowRight
                      className="size-4 text-play-blue-foreground"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-20 border-y border-border/70 bg-card"
      >
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="mb-12 max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-play-orange-foreground">
              A better loop
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              From source to understanding
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <Card
                key={step.title}
                className={cn(
                  "border-border shadow-none transition-[transform,background-color] hover:-translate-y-1",
                  step.surfaceTone,
                )}
              >
                <CardContent className="p-6">
                  <div className="mb-7 flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-11 items-center justify-center rounded-[0.7rem]",
                        step.iconTone,
                      )}
                    >
                      <step.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground/70">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {step.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Brand />
        <p>Learning that stays grounded in your source.</p>
      </footer>
    </main>
  );
}
