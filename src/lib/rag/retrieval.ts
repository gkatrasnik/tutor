import "server-only";

import { and, asc, cosineDistance, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { courses, materialChunks, materials } from "@/db/schema";
import { env } from "@/lib/env";
import type { AiContext } from "@/lib/usage/contracts";

import { RETRIEVAL_LIMIT } from "./contracts";
import { EmbeddingError, embedQuery } from "./embeddings";

async function assertCompatibleIndex(scope: SQL | undefined) {
  const [incompatible] = await db
    .select({ id: materialChunks.id })
    .from(materialChunks)
    .innerJoin(materials, eq(materials.id, materialChunks.materialId))
    .innerJoin(courses, eq(courses.id, materials.courseId))
    .where(
      and(
        scope,
        sql`${materialChunks.embeddingModel} is distinct from ${env.EMBEDDING_MODEL}`,
      ),
    )
    .limit(1);
  if (incompatible)
    throw new EmbeddingError(
      "These materials need an embedding migration before retrieval. Run the embedding-only re-embedding command for the configured model.",
    );
}

export type RetrievalResult = {
  id: string;
  ordinal: number;
  pageNumber: number | null;
  content: string;
  similarity: number;
};

export async function retrieveCourseChunks({
  ownerId,
  courseId,
  query,
  signal,
  usage,
}: {
  ownerId: string;
  courseId: string;
  query: string;
  signal?: AbortSignal;
  usage?: AiContext;
}) {
  const scope = and(
    eq(courses.id, courseId),
    eq(courses.ownerId, ownerId),
    eq(materials.ownerId, ownerId),
    eq(materialChunks.ownerId, ownerId),
    eq(materials.status, "ready"),
  );
  await assertCompatibleIndex(scope);
  const queryEmbedding = await embedQuery(query, signal, {
    ...usage,
    ownerId,
    requestId: usage?.requestId ?? crypto.randomUUID(),
  });
  const distance = cosineDistance(materialChunks.embedding, queryEmbedding);
  return db
    .select({
      id: materialChunks.id,
      filename: materials.originalFilename,
      ordinal: materialChunks.ordinal,
      pageNumber: materialChunks.pageNumber,
      content: materialChunks.content,
    })
    .from(materialChunks)
    .innerJoin(materials, eq(materials.id, materialChunks.materialId))
    .innerJoin(courses, eq(courses.id, materials.courseId))
    .where(and(scope, eq(materialChunks.embeddingModel, env.EMBEDDING_MODEL)))
    .orderBy(asc(distance), asc(materialChunks.id))
    .limit(RETRIEVAL_LIMIT);
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
  await assertCompatibleIndex(
    and(
      eq(materialChunks.ownerId, ownerId),
      eq(materialChunks.materialId, materialId),
      eq(materials.ownerId, ownerId),
      eq(courses.ownerId, ownerId),
    ),
  );
  const queryEmbedding = await embedQuery(query, undefined, {
    ownerId,
    requestId: crypto.randomUUID(),
  });
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
    .where(
      and(
        eq(materialChunks.ownerId, ownerId),
        eq(materialChunks.materialId, materialId),
        eq(materialChunks.embeddingModel, env.EMBEDDING_MODEL),
      ),
    )
    .orderBy(asc(distance))
    .limit(RETRIEVAL_LIMIT);
}
