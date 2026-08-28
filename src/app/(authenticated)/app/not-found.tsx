import { SearchX } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AppNotFound() {
  return (
    <main className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10">
      <Card className="mx-auto max-w-lg bg-card">
        <CardHeader>
          <SearchX
            className="mb-2 size-8 text-muted-foreground/70"
            aria-hidden="true"
          />
          <CardTitle>
            <h1 className="text-xl font-semibold">Resource not available</h1>
          </CardTitle>
          <CardDescription>
            It may have been removed, or it may belong to another account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/app" className={buttonVariants()}>
            Return to courses
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
