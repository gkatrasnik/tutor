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

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: BookMarked,
    title: "Bring your material",
    body: "Upload a private PDF or paste the text you actually need to understand.",
  },
  {
    icon: BrainCircuit,
    title: "Get a focused course",
    body: "Tutor finds the important ideas and turns them into a practical lesson path.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Learn by thinking",
    body: "Work through one question at a time with explanations grounded in your source.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <header className="relative z-20 mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Brand className="text-lg" />
        <nav
          className="flex items-center gap-2"
          aria-label="Primary navigation"
        >
          <ThemeToggle />
          <Link
            href="/app"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "hidden sm:inline-flex",
            )}
          >
            View demo
          </Link>
          <Link href="/app" className={buttonVariants({ size: "lg" })}>
            Start learning
            <ArrowRight aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:pb-32 lg:pt-24">
        <div className="pointer-events-none absolute -left-52 top-10 size-[32rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="relative z-10">
          <Badge
            variant="outline"
            className="mb-6 bg-card/70 px-3 py-1 text-primary shadow-sm"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            Your material. Your pace.
          </Badge>
          <h1 className="text-balance max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] text-foreground sm:text-6xl lg:text-7xl">
            Stop rereading. Start understanding.
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
            Tutor transforms the material in front of you into a clear course,
            then helps you reason through it with questions built around what
            you need next.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/app"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 px-5 text-base",
              )}
            >
              Create your first course
              <ArrowRight aria-hidden="true" />
            </Link>
            <div className="flex items-center gap-2 px-2 text-sm text-muted-foreground">
              <LockKeyhole className="size-4 text-primary" aria-hidden="true" />
              Private by design
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-lg lg:mx-0">
          <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-primary/20 via-warning/10 to-transparent blur-2xl" />
          <Card className="relative overflow-hidden border-border/80 bg-card/95 py-0 shadow-2xl">
            <div className="border-b bg-muted/80 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Your course
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">
                    The science of attention
                  </h2>
                </div>
                <Badge className="bg-primary/10 text-primary">4 lessons</Badge>
              </div>
            </div>
            <CardContent className="space-y-3 p-4 sm:p-6">
              {[
                ["01", "Why attention is selective", "Complete"],
                ["02", "Working memory under load", "12 min"],
                ["03", "Designing for deep focus", "18 min"],
                ["04", "Build a sustainable practice", "15 min"],
              ].map(([number, title, detail], index) => (
                <div
                  key={number}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl border p-4",
                    index === 1
                      ? "border-primary/20 bg-primary/5"
                      : "border-border/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      index === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {index === 0 ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      number
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {detail}
                    </p>
                  </div>
                  {index === 1 && (
                    <ArrowRight
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-y border-border/70 bg-card">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              A better loop
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              From source to understanding
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <Card
                key={step.title}
                className="border-border bg-background shadow-none"
              >
                <CardContent className="p-6">
                  <div className="mb-7 flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <step.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground/70">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">
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
