import { and, eq } from "drizzle-orm";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/db";
import { materials } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import {
  retrieveMaterialChunks,
  type RetrievalResult,
} from "@/lib/rag/retrieval";
import { EmbeddingError } from "@/lib/rag/embeddings";
import { AiLimitError } from "@/lib/usage/contracts";
import { enforceAiRateLimit } from "@/lib/usage/rate-limit";

const idSchema = z.uuid();
const querySchema = z.string().trim().min(1).max(500);

export default async function RetrievalInspectorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ query?: string | string[] }>;
}) {
  const user = await requireAdmin();
  const parsedId = idSchema.safeParse((await params).id);
  if (!parsedId.success) notFound();

  const [material] = await db
    .select({
      id: materials.id,
      courseId: materials.courseId,
      title: materials.originalFilename,
      status: materials.status,
    })
    .from(materials)
    .where(and(eq(materials.id, parsedId.data), eq(materials.ownerId, user.id)))
    .limit(1);
  if (!material) notFound();

  const rawQuery = (await searchParams).query;
  const parsedQuery = querySchema.safeParse(
    Array.isArray(rawQuery) ? rawQuery[0] : rawQuery,
  );
  const query = parsedQuery.success ? parsedQuery.data : "";
  let results: RetrievalResult[] = [];
  let retrievalError: string | null = null;
  if (query && material.status === "ready") {
    try {
      await enforceAiRateLimit(user.id);
      results = await retrieveMaterialChunks({
        ownerId: user.id,
        materialId: material.id,
        query,
      });
    } catch (error) {
      retrievalError =
        error instanceof AiLimitError || error instanceof EmbeddingError
          ? error.message
          : "Retrieval failed. Please try again.";
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-5 sm:p-8 lg:p-10">
      <Link
        href={`/app/courses/${material.courseId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to course
      </Link>

      <div className="mt-6">
        <p className="text-sm font-medium text-primary">Admin tool</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Retrieval inspector
        </h1>
        <p className="mt-2 text-muted-foreground">
          See the six semantic chunks Tutor retrieves from “{material.title}”.
        </p>
      </div>

      <Card className="mt-8 border-border bg-card">
        <CardHeader>
          <CardTitle>Test a learner query</CardTitle>
          <CardDescription>
            The query is embedded as <code>search_query</code>; stored chunks
            use <code>search_document</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="retrieval-query">Query</Label>
              <Input
                id="retrieval-query"
                name="query"
                defaultValue={query}
                maxLength={500}
                placeholder="e.g. How does photosynthesis store energy?"
                required
              />
            </div>
            <Button type="submit">
              <Search aria-hidden="true" /> Retrieve
            </Button>
          </form>
        </CardContent>
      </Card>

      {rawQuery && !parsedQuery.success ? (
        <p className="mt-4 text-sm text-destructive">
          Enter a query between 1 and 500 characters.
        </p>
      ) : null}
      {retrievalError ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {retrievalError}
        </p>
      ) : null}
      {material.status !== "ready" ? (
        <p className="mt-4 text-sm text-warning">
          This material must finish processing before retrieval can run.
        </p>
      ) : null}

      {query ? (
        <section className="mt-8" aria-labelledby="results-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="results-heading" className="text-lg font-semibold">
              Closest chunks
            </h2>
            <Badge variant="outline">{results.length} results</Badge>
          </div>
          <div className="grid gap-4">
            {results.map((result, index) => (
              <Card key={result.id} className="border-border bg-card">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{index + 1}</Badge>
                    <Badge variant="outline">
                      Similarity {Number(result.similarity).toFixed(4)}
                    </Badge>
                    <Badge variant="secondary">
                      {result.pageNumber
                        ? `Page ${result.pageNumber}`
                        : "Pasted text"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Chunk {result.ordinal + 1}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/80">
                    {result.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
