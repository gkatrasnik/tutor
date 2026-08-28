"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ErrorFallback({
  title,
  description,
  error,
  retry,
  returnHref,
  returnLabel,
}: {
  title: string;
  description: string;
  error: Error & { digest?: string };
  retry: () => void;
  returnHref: string;
  returnLabel: string;
}) {
  return (
    <Card className="mx-auto max-w-lg bg-card" role="alert">
      <CardHeader>
        <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" aria-hidden="true" />
        </span>
        <CardTitle>
          <h1 className="text-xl font-semibold">{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {error.digest ? (
          <p className="mb-4 text-xs text-muted-foreground">
            Reference: <code>{error.digest}</code>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => retry()}>
            Try again
          </Button>
          <Link
            href={returnHref}
            className={buttonVariants({ variant: "outline" })}
          >
            {returnLabel}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
