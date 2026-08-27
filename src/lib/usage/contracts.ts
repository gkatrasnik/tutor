export const INGESTION_DAILY_LIMIT = 3;
export const AI_REQUESTS_PER_MINUTE = 5;

export class AiLimitError extends Error {
  constructor(
    message: string,
    public readonly status = 429,
    public readonly retryAfter = 60,
  ) {
    super(message);
  }
}

export function aiLimitResponse(error: unknown) {
  if (!(error instanceof AiLimitError)) return null;
  return Response.json(
    { error: error.message },
    {
      status: error.status,
      headers: {
        "Retry-After": String(error.retryAfter),
        "Cache-Control": "no-store",
      },
    },
  );
}

export type AiContext = {
  ownerId: string;
  requestId: string;
  reservationId?: string;
};

export { gatewayCost, usageMetrics, safeAiErrorCode } from "./metrics.mjs";
