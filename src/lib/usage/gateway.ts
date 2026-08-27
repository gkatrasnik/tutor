import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiUsageEvents } from "@/db/schema";
import { safeAiErrorCode, usageMetrics, type AiContext } from "./contracts";
import { markQuotaStarted } from "./quotas";

type Feature = typeof aiUsageEvents.$inferInsert.feature;
export type GatewaySpan = { observe: (result: unknown) => void; firstToken: () => void };

export async function recordGateway<T>(context: AiContext, feature: Feature, model: string,
  operation: (span: GatewaySpan) => Promise<T>): Promise<T> {
  if (!process.env.AI_GATEWAY_API_KEY?.trim()) throw new Error("A dedicated AI_GATEWAY_API_KEY is required for budget-controlled AI requests.");
  const id = crypto.randomUUID();
  // Fail closed before AI spend if the durable pending record cannot be created.
  await db.insert(aiUsageEvents).values({ id, ownerId: context.ownerId, requestId: context.requestId, feature, model });
  let started = performance.now();
  let firstToken: number | null = null;
  let metrics = usageMetrics(undefined);
  const span: GatewaySpan = {
    observe(result) {
      const next = usageMetrics(result);
      metrics = Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, next[key as keyof typeof next] ?? value])) as typeof metrics;
    },
    firstToken() { firstToken ??= Math.round(performance.now() - started); },
  };
  async function finish(status: "success" | "failure", errorCode: string | null) {
    try {
      await db.update(aiUsageEvents).set({ ...metrics, status, errorCode,
        latencyMs: Math.round(performance.now() - started), timeToFirstTokenMs: firstToken })
        .where(and(eq(aiUsageEvents.id, id), eq(aiUsageEvents.ownerId, context.ownerId), eq(aiUsageEvents.status, "pending")));
    } catch {
      // Preserve the pending event for reconciliation. Never retry billable work
      // because accounting completion failed, or log prompts/provider responses.
      console.error("AI usage finalization failed", { eventId: id });
    }
  }
  try {
    if (context.reservationId) await markQuotaStarted(context.reservationId, context.ownerId);
    started = performance.now();
    const result = await operation(span);
    await finish("success", null);
    return result;
  } catch (error) {
    span.observe(error);
    await finish("failure", safeAiErrorCode(error));
    throw error;
  }
}
