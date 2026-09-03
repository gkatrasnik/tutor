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
        "group inline-flex items-center gap-2 font-heading font-bold tracking-tight",
        className,
      )}
      aria-label="Tutor home"
    >
      <TutorMark className="size-8 shadow-sm transition-transform group-hover:-rotate-3" />
      <span>Tutor</span>
    </Link>
  );
}

export function TutorMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("shrink-0 rounded-[0.65rem]", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="#2FA84F" />
      <path
        d="M7 9.4c3.8-.7 6.8.2 9 2.4v12c-2.2-2.2-5.2-3-9-2.3V9.4Z"
        fill="white"
      />
      <path
        d="M25 9.4c-3.8-.7-6.8.2-9 2.4v12c2.2-2.2 5.2-3 9-2.3V9.4Z"
        fill="#CFE8FF"
      />
      <path d="M16 11.8v12" stroke="#18753A" strokeWidth="1.5" />
    </svg>
  );
}
