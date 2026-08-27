import "server-only";

import { env } from "@/lib/env";
import { createEmbeddingClient } from "./embedding-client.mjs";
import { recordGateway } from "@/lib/usage/gateway";
import type { AiContext } from "@/lib/usage/contracts";

export { EmbeddingError } from "./embedding-client.mjs";

function client(context: AiContext) {
  return createEmbeddingClient({
    model: env.EMBEDDING_MODEL,
    dimensions: env.EMBEDDING_DIMENSION,
    execute: (call) =>
      recordGateway({
        context,
        feature: "embedding",
        model: env.EMBEDDING_MODEL,
        run: async (recorder) => {
          const result = await call();
          recorder.recordMetrics(result);
          return result;
        },
      }),
  });
}

export function embedDocuments(values: string[], context: AiContext) {
  return client(context).embedDocuments(values);
}
export function embedQuery(
  value: string,
  signal: AbortSignal | undefined,
  context: AiContext,
) {
  return client(context).embedQuery(value, signal);
}
