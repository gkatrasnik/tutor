import { createEmbeddingClient } from "../src/lib/rag/embedding-client.mjs";
import { safeAiErrorCode, usageMetrics } from "../src/lib/usage/metrics.mjs";

// Administrative CLI counterpart of the server-only Gateway wrapper. Maintenance
// bypasses learner quotas but never accounting. Null owner = synthetic probe.
/** @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} database
 * @param {string} model @param {number} dimensions @param {string} requestId @param {string | null} ownerId */
export function trackedEmbeddingClient(
  database,
  model,
  dimensions,
  requestId,
  ownerId,
) {
  return createEmbeddingClient({
    model,
    dimensions,
    execute: async (call) => {
      const id = crypto.randomUUID();
      await database.query(
        `INSERT INTO ai_usage_events(id, owner_id, request_id, feature, model)
      VALUES ($1,$2,$3,'embedding',$4)`,
        [id, ownerId, requestId, model],
      );
      const started = performance.now();
      let metrics = usageMetrics(undefined);
      let status = "success";
      let errorCode = null;
      try {
        const result = await call();
        metrics = usageMetrics(result);
        return result;
      } catch (error) {
        status = "failure";
        errorCode = safeAiErrorCode(error);
        metrics = usageMetrics(error);
        throw error;
      } finally {
        try {
          await database.query(
            `UPDATE ai_usage_events SET status = $2, input_tokens = $3, output_tokens = $4,
          cached_tokens = $5, reasoning_tokens = $6, total_tokens = $7, cost_usd = $8,
          gateway_generation_id = $9, latency_ms = $10, error_code = $11 WHERE id = $1 AND status = 'pending'`,
            [
              id,
              status,
              metrics.inputTokens,
              metrics.outputTokens,
              metrics.cachedTokens,
              metrics.reasoningTokens,
              metrics.totalTokens,
              metrics.costUsd,
              metrics.gatewayGenerationId,
              Math.round(performance.now() - started),
              errorCode,
            ],
          );
        } catch {
          console.error("AI usage finalization failed", { eventId: id });
        }
      }
    },
  });
}
