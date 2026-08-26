import "server-only";

import { embed, embedMany } from "ai";

import { env } from "@/lib/env";

import {
  cohereEmbeddingOptions,
  EMBEDDING_BATCH_SIZE,
  type CohereEmbeddingInputType,
} from "./contracts";

export class EmbeddingError extends Error {}

function validateEmbedding(embedding: number[]) {
  if (
    embedding.length !== env.EMBEDDING_DIMENSION
    || embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new EmbeddingError(
      `The embedding provider returned an invalid vector. Expected ${env.EMBEDDING_DIMENSION} float values.`,
    );
  }
  return embedding;
}

function providerOptions(inputType: CohereEmbeddingInputType) {
  return cohereEmbeddingOptions(inputType, env.EMBEDDING_DIMENSION);
}

export async function embedDocuments(values: string[]) {
  const embeddings: number[][] = [];

  try {
    for (let start = 0; start < values.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = values.slice(start, start + EMBEDDING_BATCH_SIZE);
      const result = await embedMany({
        model: env.EMBEDDING_MODEL,
        values: batch,
        providerOptions: providerOptions("search_document"),
        maxParallelCalls: 1,
      });

      if (result.embeddings.length !== batch.length) {
        throw new EmbeddingError("The embedding provider returned an incomplete batch.");
      }
      embeddings.push(...result.embeddings.map(validateEmbedding));
    }
  } catch (error) {
    if (error instanceof EmbeddingError) throw error;
    throw new EmbeddingError("Tutor could not index this material through AI Gateway. Check the Gateway connection and retry.");
  }

  return embeddings;
}

export async function embedQuery(value: string, abortSignal?: AbortSignal) {
  try {
    const result = await embed({
      model: env.EMBEDDING_MODEL,
      value,
      abortSignal,
      providerOptions: providerOptions("search_query"),
    });
    return validateEmbedding(result.embedding);
  } catch (error) {
    if (error instanceof EmbeddingError) throw error;
    throw new EmbeddingError("Tutor could not run retrieval through AI Gateway. Check the Gateway connection and retry.");
  }
}
