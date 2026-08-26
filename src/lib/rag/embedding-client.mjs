import { embed, embedMany } from "ai";

export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_BATCH_SIZE = 50;
export class EmbeddingError extends Error {}

/** @param {number[]} embedding @param {number} dimensions */
export function validateEmbedding(embedding, dimensions) {
  if (embedding.length !== dimensions || embedding.some((value) => !Number.isFinite(value))) {
    throw new EmbeddingError(`The embedding provider returned an invalid vector. Expected ${dimensions} float values.`);
  }
  return embedding;
}

/** @param {string} model @param {number} dimensions @param {"search_document" | "search_query"} inputType */
export function embeddingProviderOptions(model, dimensions, inputType) {
  if (model === DEFAULT_EMBEDDING_MODEL) return { openai: { dimensions } };
  if (model === "cohere/embed-v4.0") {
    return { cohere: { inputType, outputDimension: dimensions, embeddingTypes: ["float"] } };
  }
  throw new EmbeddingError(`Unsupported embedding model: ${model}. Configure and migrate a supported embedding model first.`);
}

/** @param {unknown} error */
function isRateLimit(error) {
  return error instanceof Object && "statusCode" in error && error.statusCode === 429;
}

/** @param {unknown} error @param {string} operation */
function embeddingFailure(error, operation) {
  if (error instanceof EmbeddingError) return error;
  return new EmbeddingError(isRateLimit(error)
    ? "AI Gateway rate-limited the embedding model (429). Wait and retry, or check your Gateway credits and model limits."
    : `Tutor could not ${operation} through AI Gateway. Check the Gateway connection and retry.`, { cause: error });
}

// Shared by the server-only application wrapper and the administrative CLI.
/** @param {{ model: string, dimensions: number }} config */
export function createEmbeddingClient({ model, dimensions }) {
  return {
    /** @param {string[]} values @param {AbortSignal} [signal] */
    async embedDocuments(values, signal) {
      /** @type {number[][]} */
      const embeddings = [];
      try {
        const providerOptions = embeddingProviderOptions(model, dimensions, "search_document");
        for (let start = 0; start < values.length; start += EMBEDDING_BATCH_SIZE) {
          const batch = values.slice(start, start + EMBEDDING_BATCH_SIZE);
          const result = await embedMany({ model, values: batch, providerOptions,
            maxParallelCalls: 1, maxRetries: 0, abortSignal: signal ?? AbortSignal.timeout(60_000) });
          if (result.embeddings.length !== batch.length) throw new EmbeddingError("The embedding provider returned an incomplete batch.");
          embeddings.push(...result.embeddings.map((value) => validateEmbedding(value, dimensions)));
        }
      } catch (error) { throw embeddingFailure(error, "index this material"); }
      return embeddings;
    },
    /** @param {string} value @param {AbortSignal} [signal] */
    async embedQuery(value, signal) {
      try {
        const result = await embed({ model, value,
          providerOptions: embeddingProviderOptions(model, dimensions, "search_query"),
          maxRetries: 0, abortSignal: signal ?? AbortSignal.timeout(60_000) });
        return validateEmbedding(result.embedding, dimensions);
      } catch (error) { throw embeddingFailure(error, "run retrieval"); }
    },
  };
}
