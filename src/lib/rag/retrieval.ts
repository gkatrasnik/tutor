import "server-only";

import { and, asc, cosineDistance, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { materialChunks } from "@/db/schema";

import { RETRIEVAL_LIMIT } from "./contracts";
import { embedQuery } from "./embeddings";

export type RetrievalResult = {
  id: string;
  ordinal: number;
  pageNumber: number | null;
  content: string;
  similarity: number;
};

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
