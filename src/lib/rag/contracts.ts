export const CHUNK_TARGET_TOKENS = 800;
export const CHUNK_OVERLAP_TOKENS = 100;
export const MAX_CHUNKS_PER_MATERIAL = 150;
export const EMBEDDING_BATCH_SIZE = 50;
export const RETRIEVAL_LIMIT = 6;

export type CohereEmbeddingInputType = "search_document" | "search_query";

export function cohereEmbeddingOptions(
  inputType: CohereEmbeddingInputType,
  outputDimension: number,
) {
  return {
    cohere: {
      inputType,
      outputDimension,
      embeddingTypes: ["float"],
    },
  };
}
