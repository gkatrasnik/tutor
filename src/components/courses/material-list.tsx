import { and, desc, eq, exists } from "drizzle-orm";
import Link from "next/link";

import { MaterialActions } from "@/app/(authenticated)/app/materials/material-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { courses, materialChunks, materials } from "@/db/schema";

export async function MaterialList({
  ownerId,
  courseId,
}: {
  ownerId: string;
  courseId?: string;
}) {
  const library = await db
    .select({
      id: materials.id,
      courseId: materials.courseId,
      courseName: courses.name,
      filename: materials.originalFilename,
      status: materials.status,
      error: materials.processingError,
      sourceType: materials.sourceType,
      pageCount: materials.pageCount,
      indexed: exists(
        db
          .select({ id: materialChunks.id })
          .from(materialChunks)
          .where(
            and(
              eq(materialChunks.materialId, materials.id),
              eq(materialChunks.ownerId, ownerId),
            ),
          ),
      ),
    })
    .from(materials)
    .innerJoin(
      courses,
      and(eq(courses.id, materials.courseId), eq(courses.ownerId, ownerId)),
    )
    .where(
      and(
        eq(materials.ownerId, ownerId),
        courseId ? eq(materials.courseId, courseId) : undefined,
      ),
    )
    .orderBy(desc(materials.createdAt));

  if (!library.length)
    return (
      <p className="rounded-xl border border-dashed p-6 text-sm text-stone-500">
        No materials yet. Add PDFs or pasted notes inside a course.
      </p>
    );

  return (
    <div className="grid gap-3">
      {library.map((material) => (
        <Card key={material.id} className="bg-white">
          <CardContent className="flex flex-wrap items-start gap-3 p-5">
            <div className="min-w-0 flex-1 basis-48">
              <h3 className="break-words font-medium">{material.filename}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    material.status === "failed" ? "destructive" : "secondary"
                  }
                >
                  {material.status === "ready"
                    ? material.indexed
                      ? "Indexed"
                      : "Needs indexing"
                    : material.status === "processing"
                      ? "Processing"
                      : material.status === "failed"
                        ? "Needs attention"
                        : "Uploaded"}
                </Badge>
                <span className="text-xs text-stone-500">
                  {material.sourceType === "pdf" ? "PDF" : "Pasted text"}
                  {material.pageCount ? ` · ${material.pageCount} pages` : ""}
                </span>
              </div>
              {!courseId ? (
                <Link
                  href={`/app/courses/${material.courseId}`}
                  className="mt-2 inline-block text-sm text-emerald-700 hover:underline"
                >
                  {material.courseName}
                </Link>
              ) : null}
              {material.error ? (
                <p className="mt-2 text-sm text-red-700">{material.error}</p>
              ) : null}
              {process.env.NODE_ENV === "development" &&
              material.status === "ready" &&
              material.indexed ? (
                <Link
                  href={`/app/materials/${material.id}/retrieval`}
                  className="mt-2 block text-xs text-stone-500 hover:underline"
                >
                  Inspect retrieval
                </Link>
              ) : null}
            </div>
            <MaterialActions
              id={material.id}
              title={material.filename}
              canRetry={material.status !== "ready" || !material.indexed}
              retryLabel={material.status === "ready" ? "Index" : "Retry"}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
