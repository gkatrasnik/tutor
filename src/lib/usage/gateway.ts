import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiUsageEvents } from "@/db/schema";
import { safeAiErrorCode, usageMetrics, type AiContext } from "./contracts";
import { markQuotaStarted } from "./quotas";

type Feature = typeof aiUsageEvents.$inferInsert.feature;
type Metrics = ReturnType<typeof usageMetrics>;

type GatewayUsageRecorder = {
  recordMetrics: (result: unknown) => void;
  markFirstToken: () => void;
};

type RecordGatewayOptions<T> = {
  context: AiContext;
  feature: Feature;
  model: string;
  run: (recorder: GatewayUsageRecorder) => Promise<T>;
};

function mergeKnownMetrics(current: Metrics, result: unknown): Metrics {
  const next = usageMetrics(result);
  return {
    inputTokens: next.inputTokens ?? current.inputTokens,
    outputTokens: next.outputTokens ?? current.outputTokens,
    cachedTokens: next.cachedTokens ?? current.cachedTokens,
    reasoningTokens: next.reasoningTokens ?? current.reasoningTokens,
    totalTokens: next.totalTokens ?? current.totalTokens,
    costUsd: next.costUsd ?? current.costUsd,
    gatewayGenerationId:
      next.gatewayGenerationId ?? current.gatewayGenerationId,
  };
}

export async function recordGateway<T>({
  context,
  feature,
  model,
  run,
}: RecordGatewayOptions<T>): Promise<T> {
  if (!process.env.AI_GATEWAY_API_KEY?.trim())
    throw new Error(
      "A dedicated AI_GATEWAY_API_KEY is required for budget-controlled AI requests.",
    );
  const id = crypto.randomUUID();
  // Fail closed before AI spend if the durable pending record cannot be created.
  await db.insert(aiUsageEvents).values({
    id,
    ownerId: context.ownerId,
    requestId: context.requestId,
    feature,
    model,
  });
  let operationStartedAt = performance.now();
  let timeToFirstTokenMs: number | null = null;
  let metrics = usageMetrics(undefined);
  const recorder: GatewayUsageRecorder = {
    recordMetrics: (result) => {
      metrics = mergeKnownMetrics(metrics, result);
    },
    markFirstToken: () => {
      timeToFirstTokenMs ??= Math.round(performance.now() - operationStartedAt);
    },
  };
  async function finalizeUsageEvent(
    status: "success" | "failure",
    errorCode: string | null,
  ) {
    try {
      await db
        .update(aiUsageEvents)
        .set({
          ...metrics,
          status,
          errorCode,
          latencyMs: Math.round(performance.now() - operationStartedAt),
          timeToFirstTokenMs,
        })
        .where(
          and(
            eq(aiUsageEvents.id, id),
            eq(aiUsageEvents.ownerId, context.ownerId),
            eq(aiUsageEvents.status, "pending"),
          ),
        );
    } catch {
      // Preserve the pending event for reconciliation. Never retry billable work
      // because accounting completion failed, or log prompts/provider responses.
      console.error("AI usage finalization failed", { eventId: id });
    }
  }
  try {
    if (context.reservationId)
      await markQuotaStarted(context.reservationId, context.ownerId);
    operationStartedAt = performance.now();
    const result = await run(recorder);
    await finalizeUsageEvent("success", null);
    return result;
  } catch (error) {
    recorder.recordMetrics(error);
    await finalizeUsageEvent("failure", safeAiErrorCode(error));
    throw error;
  }
}
