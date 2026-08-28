import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { aiUsageEvents, profiles, tutorDailyUsage } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { TUTOR_DAILY_LIMIT } from "@/lib/tutor/contracts";
import { INGESTION_DAILY_LIMIT } from "@/lib/usage/contracts";

import {
  ADMIN_USAGE_PAGE_SIZE,
  analyticsRangeStart,
  type AnalyticsRange,
  type RequestFilters,
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

export async function getLearnerQuotas(ownerId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const [daily] = await db
    .select({
      turns: tutorDailyUsage.turns,
      ingestions: tutorDailyUsage.ingestions,
    })
    .from(tutorDailyUsage)
    .where(
      and(eq(tutorDailyUsage.ownerId, ownerId), eq(tutorDailyUsage.day, day)),
    )
    .limit(1);

  return {
    tutor: {
      used: daily?.turns ?? 0,
      limit: TUTOR_DAILY_LIMIT,
      remaining: Math.max(0, TUTOR_DAILY_LIMIT - (daily?.turns ?? 0)),
    },
    ingestion: {
      used: daily?.ingestions ?? 0,
      limit: INGESTION_DAILY_LIMIT,
      remaining: Math.max(0, INGESTION_DAILY_LIMIT - (daily?.ingestions ?? 0)),
    },
  };
}

export async function getAdminAnalytics(
  range: AnalyticsRange,
  requestedPage: number,
  requestFilters: RequestFilters = {
    user: "",
    model: "",
    feature: null,
    status: null,
    sort: "newest",
  },
) {
  const admin = await requireAdmin();
  const page = Math.max(1, requestedPage);
  const from = analyticsRangeStart(range);
  const dateScope = gte(aiUsageEvents.createdAt, from);
  const requestConditions: SQL[] = [dateScope];
  if (requestFilters.user)
    requestConditions.push(
      ilike(profiles.email, containsPattern(requestFilters.user)),
    );
  if (requestFilters.model)
    requestConditions.push(
      ilike(aiUsageEvents.model, containsPattern(requestFilters.model)),
    );
  if (requestFilters.feature)
    requestConditions.push(eq(aiUsageEvents.feature, requestFilters.feature));
  if (requestFilters.status)
    requestConditions.push(eq(aiUsageEvents.status, requestFilters.status));
  const requestScope = and(...requestConditions);
  const requestOrder = requestOrderBy(requestFilters.sort);
  const offset = (page - 1) * ADMIN_USAGE_PAGE_SIZE;
  const averageLatency =
    sql<number>`coalesce(round(avg(${aiUsageEvents.latencyMs})), 0)::integer`.mapWith(
      Number,
    );

  const [
    summaryRows,
    byFeature,
    byModel,
    byDay,
    byUser,
    requests,
    requestTotalRows,
    failures,
  ] = await Promise.all([
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
      .where(dateScope),
    db
      .select({
        feature: aiUsageEvents.feature,
        requests: requestCount,
        totalTokens: integerSum(aiUsageEvents.totalTokens),
        errors: errorCount,
        costUsd: knownCost,
      })
      .from(aiUsageEvents)
      .where(dateScope)
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
      .where(dateScope)
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
      .where(dateScope)
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
      .where(and(dateScope, isNotNull(aiUsageEvents.ownerId)))
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
      .where(requestScope)
      .orderBy(...requestOrder)
      .limit(ADMIN_USAGE_PAGE_SIZE)
      .offset(offset),
    db
      .select({ requests: count(aiUsageEvents.id) })
      .from(aiUsageEvents)
      .leftJoin(profiles, eq(profiles.id, aiUsageEvents.ownerId))
      .where(requestScope),
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
      .where(and(dateScope, eq(aiUsageEvents.status, "failure")))
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
  const requestTotal = requestTotalRows[0]?.requests ?? 0;
  return {
    admin,
    range,
    requestFilters,
    from,
    page,
    pageCount: Math.max(1, Math.ceil(requestTotal / ADMIN_USAGE_PAGE_SIZE)),
    requestTotal,
    summary,
    byFeature,
    byModel,
    byDay,
    byUser,
    requests,
    failures,
  };
}

function containsPattern(value: string) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

function requestOrderBy(sort: RequestFilters["sort"]): SQL[] {
  switch (sort) {
    case "oldest":
      return [asc(aiUsageEvents.createdAt), asc(aiUsageEvents.id)];
    case "user_asc":
      return [
        sql`${profiles.email} asc nulls last`,
        desc(aiUsageEvents.createdAt),
      ];
    case "user_desc":
      return [
        sql`${profiles.email} desc nulls last`,
        desc(aiUsageEvents.createdAt),
      ];
    case "feature_asc":
      return [asc(aiUsageEvents.feature), desc(aiUsageEvents.createdAt)];
    case "model_asc":
      return [asc(aiUsageEvents.model), desc(aiUsageEvents.createdAt)];
    case "status_asc":
      return [asc(aiUsageEvents.status), desc(aiUsageEvents.createdAt)];
    case "tokens_desc":
      return [
        sql`${aiUsageEvents.totalTokens} desc nulls last`,
        desc(aiUsageEvents.createdAt),
      ];
    case "latency_desc":
      return [
        sql`${aiUsageEvents.latencyMs} desc nulls last`,
        desc(aiUsageEvents.createdAt),
      ];
    case "cost_desc":
      return [
        sql`${aiUsageEvents.costUsd} desc nulls last`,
        desc(aiUsageEvents.createdAt),
      ];
    default:
      return [desc(aiUsageEvents.createdAt), desc(aiUsageEvents.id)];
  }
}
