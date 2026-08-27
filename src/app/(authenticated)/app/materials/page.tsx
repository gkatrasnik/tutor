import Link from "next/link";

import { MaterialList } from "@/components/courses/material-list";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const user = await requireUser();
  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10">
      <p className="text-sm font-medium text-emerald-700">
        Private source library
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Materials</h1>
      <p className="mt-2 text-stone-500">
        All your course materials in one place. To add sources, open or create a
        course.
      </p>
      <Link
        href="/app"
        className={buttonVariants({ variant: "outline", className: "mt-5" })}
      >
        Go to courses
      </Link>
      <section className="mt-8" aria-label="Your materials">
        <MaterialList ownerId={user.id} />
      </section>
    </main>
  );
}
