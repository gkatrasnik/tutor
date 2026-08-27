import { BookOpenText } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        className,
      )}
      aria-label="Tutor home"
    >
      <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm">
        <BookOpenText className="size-4" aria-hidden="true" />
      </span>
      <span>Tutor</span>
    </Link>
  );
}
