import { BookOpenText } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function Brand({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        className,
      )}
      aria-label="Tutor home"
    >
      <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <BookOpenText className="size-4" aria-hidden="true" />
      </span>
      <span>Tutor</span>
    </Link>
  );
}
