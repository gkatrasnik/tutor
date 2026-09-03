import { and, desc, eq, exists } from "drizzle-orm";
import { FileText } from "lucide-react";
import Link from "next/link";

import { MaterialActions } from "@/app/(authenticated)/app/materials/material-actions";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { courses, materialChunks, materials } from "@/db/schema";

export async function MaterialList({
  ownerId,
  courseId,
  canInspectRetrieval = false,
}: {
  ownerId: string;
  courseId?: string;
  canInspectRetrieval?: boolean;
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
      <p className="py-4 text-sm text-muted-foreground">
        No materials yet. Add PDFs or pasted notes inside a course.
      </p>
    );

  return (
    <ul className="divide-y divide-border" aria-label="Material files">
      {library.map((material) => (
        <li key={material.id} className="flex flex-wrap items-start gap-3 py-4">
          <FileText
            className="mt-0.5 size-5 shrink-0 text-play-blue"
            aria-hidden="true"
          />
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
              <span className="text-xs text-muted-foreground">
                {material.sourceType === "pdf" ? "PDF" : "Pasted text"}
                {material.pageCount ? ` · ${material.pageCount} pages` : ""}
              </span>
            </div>
            {!courseId ? (
              <Link
                href={`/app/courses/${material.courseId}`}
                className="mt-2 inline-block text-sm text-primary hover:underline"
              >
                {material.courseName}
              </Link>
            ) : null}
            {material.error ? (
              <p className="mt-2 text-sm text-destructive">{material.error}</p>
            ) : null}
            {canInspectRetrieval &&
            material.status === "ready" &&
            material.indexed ? (
              <Link
                href={`/app/materials/${material.id}/retrieval`}
                className="mt-2 block text-xs text-muted-foreground hover:underline"
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
        </li>
      ))}
    </ul>
  );
}
