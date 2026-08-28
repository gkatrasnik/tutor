import { SearchX } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-5">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <Brand />
        <SearchX className="mt-8 size-9 text-stone-400" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          The address may be incorrect, or the page may have moved.
        </p>
        <Link href="/" className={buttonVariants({ className: "mt-5" })}>
          Return home
        </Link>
      </div>
    </main>
  );
}
