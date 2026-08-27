/** @param {unknown} value @returns {Record<string, unknown>} */
function record(value) {
  return value !== null && typeof value === "object" ? /** @type {Record<string, unknown>} */ (value) : {};
}
/** @param {unknown} value */
function tokens(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647 ? value : null;
}

// Provider-reported decimal USD only. Missing metadata is unknown, not free.
/** @param {unknown} value */
export function gatewayCost(value) {
  const cost = typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1_000_000
    ? value.toFixed(18) : value;
  return typeof cost === "string" && /^\d{1,6}(?:\.\d{1,18})?$/.test(cost) ? cost : null;
}

/** @param {unknown} value */
export function usageMetrics(value) {
  const result = record(value);
  const usage = record(result.usage);
  const embeddingTokens = tokens(usage.tokens);
  const inputTokens = tokens(usage.inputTokens) ?? embeddingTokens;
  const outputTokens = tokens(usage.outputTokens);
  const gateway = record(record(result.providerMetadata).gateway);
  const generationId = gateway.generationId;
  return {
    inputTokens, outputTokens,
    cachedTokens: tokens(record(usage.inputTokenDetails).cacheReadTokens),
    reasoningTokens: tokens(record(usage.outputTokenDetails).reasoningTokens),
    totalTokens: tokens(usage.totalTokens) ?? embeddingTokens,
    costUsd: gatewayCost(gateway.cost),
    gatewayGenerationId: typeof generationId === "string" && generationId.length <= 200 ? generationId : null,
  };
}

/** @param {unknown} error */
export function safeAiErrorCode(error) {
  const value = record(error);
  if (value.statusCode === 429) return "provider_rate_limit";
  if (value.name === "AbortError" || value.name === "TimeoutError") return "aborted";
  if (value.name === "AI_NoObjectGeneratedError") return "invalid_output";
  return "gateway_operation_failed";
}
