"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";
import { Progress } from "./progress";

export function Wizard({
  step,
  total,
  onStepChange,
  canContinue,
  busy,
  onComplete,
  children,
}: {
  step: number;
  total: number;
  onStepChange: (step: number) => void;
  canContinue: boolean;
  busy: boolean;
  onComplete: () => void;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  return (
    <section aria-label="Test wizard" className="space-y-5">
      <h3 ref={heading} tabIndex={-1} className="font-semibold">
        Question {step + 1} of {total}
      </h3>
      <Progress value={((step + 1) / total) * 100} aria-label="Test progress" />
      {children}
      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          disabled={busy || step === 0}
          onClick={() => onStepChange(step - 1)}
        >
          Back
        </Button>
        <Button
          disabled={busy || !canContinue}
          onClick={() =>
            step === total - 1 ? onComplete() : onStepChange(step + 1)
          }
        >
          {busy ? "Submitting…" : step === total - 1 ? "Complete test" : "Next"}
        </Button>
      </div>
    </section>
  );
}
