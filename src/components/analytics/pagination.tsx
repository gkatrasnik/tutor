import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  href,
}: {
  page: number;
  pageCount: number;
  href: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav
      className="mt-5 flex items-center justify-between gap-3"
      aria-label="Pagination"
    >
      <Link
        href={href(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          page === 1 && "pointer-events-none opacity-50",
        )}
      >
        Previous
      </Link>
      <span className="text-sm text-stone-500">
        Page {page} of {pageCount}
      </span>
      <Link
        href={href(Math.min(pageCount, page + 1))}
        aria-disabled={page === pageCount}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          page === pageCount && "pointer-events-none opacity-50",
        )}
      >
        Next
      </Link>
    </nav>
  );
}
