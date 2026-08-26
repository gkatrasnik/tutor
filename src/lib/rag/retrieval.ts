import "server-only";

import { and, asc, cosineDistance, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { courses, materialChunks, materials } from "@/db/schema";

import { RETRIEVAL_LIMIT } from "./contracts";
import { embedQuery } from "./embeddings";

export type RetrievalResult = {
  id: string;
  ordinal: number;
  pageNumber: number | null;
  content: string;
  similarity: number;
};

export async function retrieveCourseChunks({ ownerId, courseId, query, signal }: {
  ownerId: string; courseId: string; query: string; signal?: AbortSignal;
}) {
  const queryEmbedding = await embedQuery(query, signal);
  const distance = cosineDistance(materialChunks.embedding, queryEmbedding);
  return db.select({ id: materialChunks.id, filename: materials.originalFilename,
    ordinal: materialChunks.ordinal, pageNumber: materialChunks.pageNumber, content: materialChunks.content,
  }).from(materialChunks).innerJoin(materials, eq(materials.id, materialChunks.materialId))
    .innerJoin(courses, eq(courses.id, materials.courseId))
    .where(and(eq(courses.id, courseId), eq(courses.ownerId, ownerId), eq(materials.ownerId, ownerId),
      eq(materialChunks.ownerId, ownerId), eq(materials.status, "ready")))
    .orderBy(asc(distance), asc(materialChunks.id)).limit(RETRIEVAL_LIMIT);
}

export async function retrieveMaterialChunks({
  ownerId,
  materialId,
  query,
}: {
  ownerId: string;
  materialId: string;
  query: string;
}): Promise<RetrievalResult[]> {
  const queryEmbedding = await embedQuery(query);
  const distance = cosineDistance(materialChunks.embedding, queryEmbedding);
  const similarity = sql<number>`1 - (${distance})`;

  return db
    .select({
      id: materialChunks.id,
      ordinal: materialChunks.ordinal,
      pageNumber: materialChunks.pageNumber,
      content: materialChunks.content,
      similarity,
    })
    .from(materialChunks)
    .where(and(
      eq(materialChunks.ownerId, ownerId),
      eq(materialChunks.materialId, materialId),
    ))
    .orderBy(asc(distance))
    .limit(RETRIEVAL_LIMIT);
}
