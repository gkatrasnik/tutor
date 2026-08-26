import "server-only";

import { env } from "@/lib/env";
import { createEmbeddingClient } from "./embedding-client.mjs";

export { EmbeddingError } from "./embedding-client.mjs";

export const { embedDocuments, embedQuery } = createEmbeddingClient({
  model: env.EMBEDDING_MODEL,
  dimensions: env.EMBEDDING_DIMENSION,
});
