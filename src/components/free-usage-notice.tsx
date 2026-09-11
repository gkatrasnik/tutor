import { Sparkles } from "lucide-react";

import { TUTOR_DAILY_LIMIT } from "@/lib/tutor/contracts";
import { INGESTION_DAILY_LIMIT } from "@/lib/usage/contracts";
import { cn } from "@/lib/utils";

export function FreeUsageNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm",
        className,
      )}
    >
      <p className="flex items-center gap-2 font-semibold text-primary">
        <Sparkles className="size-4 shrink-0" aria-hidden="true" />
        Free usage included
      </p>
      <p className="mt-2 leading-6 text-foreground">
        Each user gets {TUTOR_DAILY_LIMIT} tutor turns and{" "}
        {INGESTION_DAILY_LIMIT} material imports per day, free.
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Reached your limit? Both allowances reset daily at midnight UTC.
      </p>
    </div>
  );
}
