import "server-only";

import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiUsageEvents, profiles, tutorDailyUsage } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { TUTOR_DAILY_LIMIT } from "@/lib/tutor/contracts";
import { INGESTION_DAILY_LIMIT } from "@/lib/usage/contracts";

import {
  ADMIN_USAGE_PAGE_SIZE,
  analyticsRangeStart,
  type AnalyticsRange,
  USAGE_PAGE_SIZE,
} from "./contracts";

const integerSum = (column: typeof aiUsageEvents.totalTokens) =>
  sql<number>`coalesce(sum(${column}), 0)::integer`.mapWith(Number);
const requestCount = count(aiUsageEvents.id);
const errorCount =
  sql<number>`count(*) filter (where ${aiUsageEvents.status} = 'failure')::integer`.mapWith(
    Number,
  );
const knownCost = sql<string>`coalesce(sum(${aiUsageEvents.costUsd}), 0)::text`;
const unknownCostCount =
  sql<number>`count(*) filter (where ${aiUsageEvents.costUsd} is null)::integer`.mapWith(
    Number,
  );

export async function getLearnerUsage(ownerId: string, requestedPage: number) {
  const page = Math.max(1, requestedPage);
  const offset = (page - 1) * USAGE_PAGE_SIZE;
  const day = new Date().toISOString().slice(0, 10);
  const [events, totals, [daily]] = await Promise.all([
    db
      .select({
        id: aiUsageEvents.id,
        feature: aiUsageEvents.feature,
        status: aiUsageEvents.status,
        inputTokens: aiUsageEvents.inputTokens,
        outputTokens: aiUsageEvents.outputTokens,
        reasoningTokens: aiUsageEvents.reasoningTokens,
        totalTokens: aiUsageEvents.totalTokens,
        latencyMs: aiUsageEvents.latencyMs,
        timeToFirstTokenMs: aiUsageEvents.timeToFirstTokenMs,
        createdAt: aiUsageEvents.createdAt,
      })
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.ownerId, ownerId))
      .orderBy(desc(aiUsageEvents.createdAt), desc(aiUsageEvents.id))
      .limit(USAGE_PAGE_SIZE)
      .offset(offset),
    db
      .select({ requests: count(aiUsageEvents.id) })
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.ownerId, ownerId)),
    db
      .select({
        turns: tutorDailyUsage.turns,
        ingestions: tutorDailyUsage.ingestions,
      })
      .from(tutorDailyUsage)
      .where(
        and(eq(tutorDailyUsage.ownerId, ownerId), eq(tutorDailyUsage.day, day)),
      )
      .limit(1),
  ]);
  const total = totals[0]?.requests ?? 0;
  return {
    events,
    page,
    pageCount: Math.max(1, Math.ceil(total / USAGE_PAGE_SIZE)),
    total,
    quotas: {
      tutor: {
        used: daily?.turns ?? 0,
        limit: TUTOR_DAILY_LIMIT,
        remaining: Math.max(0, TUTOR_DAILY_LIMIT - (daily?.turns ?? 0)),
      },
      ingestion: {
        used: daily?.ingestions ?? 0,
        limit: INGESTION_DAILY_LIMIT,
        remaining: Math.max(
          0,
          INGESTION_DAILY_LIMIT - (daily?.ingestions ?? 0),
        ),
      },
    },
  };
}

export async function getAdminAnalytics(
  range: AnalyticsRange,
  requestedPage: number,
) {
  const admin = await requireAdmin();
  const page = Math.max(1, requestedPage);
  const from = analyticsRangeStart(range);
  const scope = gte(aiUsageEvents.createdAt, from);
  const offset = (page - 1) * ADMIN_USAGE_PAGE_SIZE;
  const averageLatency =
    sql<number>`coalesce(round(avg(${aiUsageEvents.latencyMs})), 0)::integer`.mapWith(
      Number,
    );

  const [summaryRows, byFeature, byModel, byDay, byUser, requests, failures] =
    await Promise.all([
      db
        .select({
          requests: requestCount,
          totalTokens: integerSum(aiUsageEvents.totalTokens),
          averageLatencyMs: averageLatency,
          errors: errorCount,
          costUsd: knownCost,
          unknownCosts: unknownCostCount,
        })
        .from(aiUsageEvents)
        .where(scope),
      db
        .select({
          feature: aiUsageEvents.feature,
          requests: requestCount,
          totalTokens: integerSum(aiUsageEvents.totalTokens),
          errors: errorCount,
          costUsd: knownCost,
        })
        .from(aiUsageEvents)
        .where(scope)
        .groupBy(aiUsageEvents.feature)
        .orderBy(desc(requestCount)),
      db
        .select({
          model: aiUsageEvents.model,
          requests: requestCount,
          totalTokens: integerSum(aiUsageEvents.totalTokens),
          errors: errorCount,
          costUsd: knownCost,
        })
        .from(aiUsageEvents)
        .where(scope)
        .groupBy(aiUsageEvents.model)
        .orderBy(desc(requestCount)),
      db
        .select({
          day: sql<string>`to_char(${aiUsageEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
          requests: requestCount,
          totalTokens: integerSum(aiUsageEvents.totalTokens),
          errors: errorCount,
          costUsd: knownCost,
        })
        .from(aiUsageEvents)
        .where(scope)
        .groupBy(
          sql`to_char(${aiUsageEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        )
        .orderBy(
          sql`to_char(${aiUsageEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD') desc`,
        ),
      db
        .select({
          ownerId: aiUsageEvents.ownerId,
          email: profiles.email,
          requests: requestCount,
          totalTokens: integerSum(aiUsageEvents.totalTokens),
          errors: errorCount,
          costUsd: knownCost,
        })
        .from(aiUsageEvents)
        .leftJoin(profiles, eq(profiles.id, aiUsageEvents.ownerId))
        .where(and(scope, isNotNull(aiUsageEvents.ownerId)))
        .groupBy(aiUsageEvents.ownerId, profiles.email)
        .orderBy(desc(integerSum(aiUsageEvents.totalTokens)))
        .limit(20),
      db
        .select({
          id: aiUsageEvents.id,
          ownerId: aiUsageEvents.ownerId,
          email: profiles.email,
          feature: aiUsageEvents.feature,
          model: aiUsageEvents.model,
          status: aiUsageEvents.status,
          inputTokens: aiUsageEvents.inputTokens,
          outputTokens: aiUsageEvents.outputTokens,
          reasoningTokens: aiUsageEvents.reasoningTokens,
          totalTokens: aiUsageEvents.totalTokens,
          latencyMs: aiUsageEvents.latencyMs,
          timeToFirstTokenMs: aiUsageEvents.timeToFirstTokenMs,
          costUsd: aiUsageEvents.costUsd,
          errorCode: aiUsageEvents.errorCode,
          createdAt: aiUsageEvents.createdAt,
        })
        .from(aiUsageEvents)
        .leftJoin(profiles, eq(profiles.id, aiUsageEvents.ownerId))
        .where(scope)
        .orderBy(desc(aiUsageEvents.createdAt), desc(aiUsageEvents.id))
        .limit(ADMIN_USAGE_PAGE_SIZE)
        .offset(offset),
      db
        .select({
          id: aiUsageEvents.id,
          email: profiles.email,
          feature: aiUsageEvents.feature,
          model: aiUsageEvents.model,
          errorCode: aiUsageEvents.errorCode,
          createdAt: aiUsageEvents.createdAt,
        })
        .from(aiUsageEvents)
        .leftJoin(profiles, eq(profiles.id, aiUsageEvents.ownerId))
        .where(and(scope, eq(aiUsageEvents.status, "failure")))
        .orderBy(desc(aiUsageEvents.createdAt))
        .limit(10),
    ]);

  const summary = summaryRows[0] ?? {
    requests: 0,
    totalTokens: 0,
    averageLatencyMs: 0,
    errors: 0,
    costUsd: "0",
    unknownCosts: 0,
  };
  return {
    admin,
    range,
    from,
    page,
    pageCount: Math.max(1, Math.ceil(summary.requests / ADMIN_USAGE_PAGE_SIZE)),
    summary,
    byFeature,
    byModel,
    byDay,
    byUser,
    requests,
    failures,
  };
}
