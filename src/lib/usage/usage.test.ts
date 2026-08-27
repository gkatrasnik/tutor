import type { PGlite } from "@electric-sql/pglite";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { createTestDatabase, migrationSql } from "@/db/test-database";

const mocks = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), firewall: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { TUTOR_MODEL: "test/model" } }));
vi.mock("@vercel/firewall", () => ({ checkRateLimit: mocks.firewall }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  return { db: drizzle({ client: { query: mocks.query, transaction: mocks.transaction } as unknown as NeonQueryFunction<false, false> }) };
});
import { reserveDailyQuota, releaseUnusedQuota, markQuotaStarted } from "./quotas";
import { recordGateway } from "./gateway";
import { enforceAiRateLimit } from "./rate-limit";
import { aiLimitResponse, gatewayCost, usageMetrics, AiLimitError } from "./contracts";
import { generateCourseOutline } from "@/lib/courses/generation";
import { outlineFixture, sourceFixture } from "@/lib/courses/fixtures.test-support";
let pg: PGlite;
type Query = { sql: string; params: unknown[]; options: { arrayMode?: boolean } };
const context = () => ({ ownerId: "owner", requestId: crypto.randomUUID() });

beforeAll(async () => {
  pg = await createTestDatabase();
  await pg.exec(migrationSql("0005_tutor_sessions.sql"));
  await pg.exec(migrationSql("0008_usage_accounting.sql"));
}, 30_000);
afterAll(async () => { await pg?.close(); });
beforeEach(async () => {
  vi.resetAllMocks(); vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_FIREWALL_RATE_LIMIT_ID", "");
  vi.stubEnv("AI_GATEWAY_API_KEY", "fake-key-no-network");
  await pg.exec("TRUNCATE profiles CASCADE; INSERT INTO profiles(id,email) VALUES ('owner','a@example.test'), ('other','b@example.test')");
  mocks.query.mockImplementation((sql: string, params: unknown[], options: Query["options"]) => ({ sql, params, options,
    then(resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) {
      return pg.query(sql, params, { rowMode: options.arrayMode ? "array" : "object" }).then(resolve, reject);
    },
  }));
});

describe("atomic daily reservations", () => {
  it("permits exactly three concurrent ingestions and preserves independent tutor counters", async () => {
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => reserveDailyQuota("owner", "ingestion")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(5);
    await reserveDailyQuota("owner", "tutor");
    expect((await pg.query("SELECT turns, ingestions FROM tutor_daily_usage")).rows).toEqual([{ turns: 1, ingestions: 3 }]);
    await expect(reserveDailyQuota("other", "ingestion")).resolves.toBeTypeOf("string");
  });
  it("releases only unused reservations exactly once and only for their owner", async () => {
    const id = await reserveDailyQuota("owner", "ingestion");
    await releaseUnusedQuota(id, "other");
    expect((await pg.query("SELECT ingestions FROM tutor_daily_usage")).rows[0]).toEqual({ ingestions: 1 });
    await Promise.all([releaseUnusedQuota(id, "owner"), releaseUnusedQuota(id, "owner")]);
    expect((await pg.query("SELECT ingestions FROM tutor_daily_usage")).rows[0]).toEqual({ ingestions: 0 });
    await expect(markQuotaStarted(id, "owner")).rejects.toThrow("unavailable");
  });
  it("keeps started requests charged and never releases against a new UTC day", async () => {
    const id = await reserveDailyQuota("owner", "tutor");
    await markQuotaStarted(id, "owner");
    await releaseUnusedQuota(id, "owner");
    expect((await pg.query("SELECT turns FROM tutor_daily_usage")).rows[0]).toEqual({ turns: 1 });
    const unused = await reserveDailyQuota("owner", "ingestion");
    await pg.exec("UPDATE tutor_daily_usage SET day = '2000-01-01'; UPDATE ai_quota_reservations SET day = '2000-01-01'");
    await reserveDailyQuota("owner", "ingestion");
    await releaseUnusedQuota(unused, "owner");
    expect((await pg.query("SELECT ingestions FROM tutor_daily_usage ORDER BY day")).rows).toEqual([{ ingestions: 0 }, { ingestions: 1 }]);
  });
});

describe("rolling AI endpoint limit", () => {
  it("admits exactly five simultaneous requests, isolated by authenticated user", async () => {
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => enforceAiRateLimit("owner")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    await expect(enforceAiRateLimit("other")).resolves.toBeUndefined();
    await pg.exec("UPDATE ai_rate_limits SET requests = array_fill(now() - interval '61 seconds', ARRAY[5]) WHERE owner_id = 'owner'");
    await expect(enforceAiRateLimit("owner")).resolves.toBeUndefined();
    expect((await pg.query("SELECT cardinality(requests) AS count FROM ai_rate_limits WHERE owner_id = 'owner'")).rows[0]).toEqual({ count: 1 });
  });
  it("uses a sliding window rather than resetting at a wall-clock minute boundary", async () => {
    await pg.exec("INSERT INTO ai_rate_limits VALUES ('owner', array_fill(now() - interval '30 seconds', ARRAY[5]))");
    await expect(enforceAiRateLimit("owner")).rejects.toMatchObject({ status: 429 });
  });
  it("keys Firewall checks by server identity and fails closed for missing rules", async () => {
    vi.stubEnv("VERCEL_FIREWALL_RATE_LIMIT_ID", "tutor-ai"); vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_URL", "trusted.vercel.app");
    const request = new Request("https://trusted.vercel.app", { headers: { host: "attacker.test", "x-user-id": "other", cookie: "secret" } });
    mocks.firewall.mockResolvedValue({ rateLimited: false, error: "not-found" });
    await expect(enforceAiRateLimit("owner", request)).rejects.toMatchObject({ status: 503 });
    const options = mocks.firewall.mock.calls[0][1];
    expect(options.rateLimitKey).toBe("owner");
    expect([...options.headers.entries()]).toEqual([["host", "trusted.vercel.app"]]);
    expect(mocks.query).not.toHaveBeenCalled();
    mocks.firewall.mockResolvedValue({ rateLimited: true });
    await expect(enforceAiRateLimit("owner", request)).rejects.toMatchObject({ status: 429 });
  });
});

describe("Gateway usage ledger", () => {
  it("stores actual decimal cost and v7 token details without double-counting cached/reasoning tokens", async () => {
    const value = { usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120,
      inputTokenDetails: { cacheReadTokens: 40 }, outputTokenDetails: { reasoningTokens: 5 } },
    providerMetadata: { gateway: { cost: "0.000001234567890123", generationId: "gateway-123" } } };
    await recordGateway({ context: context(), feature: "assessment", model: "test/model", run: async (recorder) => {
      recorder.recordMetrics(value); recorder.markFirstToken(); return "ok";
    } });
    const row = (await pg.query<{ latency_ms: number; time_to_first_token_ms: number }>("SELECT * FROM ai_usage_events")).rows[0];
    expect(row).toMatchObject({ status: "success", input_tokens: 100, output_tokens: 20, total_tokens: 120,
      cached_tokens: 40, reasoning_tokens: 5, cost_usd: "0.000001234567890123", gateway_generation_id: "gateway-123" });
    expect(row.latency_ms).toBeGreaterThanOrEqual(0); expect(row.time_to_first_token_ms).toBeGreaterThanOrEqual(0);
  });
  it("records failures without leaking prompt text and keeps unknown cost nullable", async () => {
    const cause = Object.assign(new Error("secret text and private Blob URL"), { statusCode: 429 });
    await expect(recordGateway({ context: context(), feature: "embedding", model: "model", run: async () => { throw cause; } })).rejects.toBe(cause);
    const row = (await pg.query("SELECT * FROM ai_usage_events")).rows[0];
    expect(row).toMatchObject({ status: "failure", error_code: "provider_rate_limit", cost_usd: null, total_tokens: null });
    expect(JSON.stringify(row)).not.toContain("secret");
  });
  it("marks a reservation started before provider work and refuses unlogged spend", async () => {
    const ctx = { ...context(), reservationId: await reserveDailyQuota("owner", "ingestion") };
    await recordGateway({ context: ctx, feature: "embedding", model: "model", run: async () => {
      expect((await pg.query("SELECT state FROM ai_quota_reservations")).rows[0]).toEqual({ state: "started" });
    } });
    const operation = vi.fn();
    mocks.query.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(recordGateway({ context: context(), feature: "tutor", model: "model", run: operation })).rejects.toThrow();
    expect(operation).not.toHaveBeenCalled();
  });
  it("requires the dedicated Gateway key rather than silently using deployment OIDC", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    const operation = vi.fn();
    await expect(recordGateway({ context: context(), feature: "tutor", model: "model", run: operation })).rejects.toThrow("dedicated AI_GATEWAY_API_KEY");
    expect(operation).not.toHaveBeenCalled(); expect(mocks.query).not.toHaveBeenCalled();
  });
  it("keeps the pending record if finalization fails, without repeating the provider operation", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const operation = vi.fn(async () => { mocks.query.mockRejectedValueOnce(new Error("database unavailable")); return "answer"; });
      expect(await recordGateway({ context: context(), feature: "tutor", model: "model", run: operation })).toBe("answer");
      expect(operation).toHaveBeenCalledTimes(1);
      expect((await pg.query("SELECT status FROM ai_usage_events")).rows[0]).toEqual({ status: "pending" });
    } finally { log.mockRestore(); }
  });
  it("keeps explicit zero separate from missing cost and accepts embedding usage", () => {
    expect(gatewayCost(undefined)).toBeNull(); expect(gatewayCost("0")).toBe("0");
    for (const value of [-1, NaN, Infinity, "-0.2", "not a cost"]) expect(gatewayCost(value)).toBeNull();
    expect(usageMetrics({ usage: { tokens: 17 } })).toMatchObject({ inputTokens: 17, totalTokens: 17, outputTokens: null, costUsd: null });
    const response = aiLimitResponse(new AiLimitError("Wait"))!;
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("60");
  });
  it("records both outline attempts and retains Gateway cost on invalid structured output", async () => {
    const response = (text: string): Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>> => ({
      content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" }, warnings: [],
      usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
      providerMetadata: { gateway: { cost: "0.00001", generationId: crypto.randomUUID() } },
    });
    const model = new MockLanguageModelV4({ doGenerate: [response("not JSON"), response(JSON.stringify(outlineFixture))] });
    const ctx = context();
    expect(await generateCourseOutline(sourceFixture, ctx, model)).toEqual(outlineFixture);
    const rows = (await pg.query("SELECT status, cost_usd, input_tokens, total_tokens, request_id FROM ai_usage_events ORDER BY created_at")).rows;
    expect(rows).toEqual([
      { status: "failure", cost_usd: "0.000010000000000000", input_tokens: 10, total_tokens: 15, request_id: ctx.requestId },
      { status: "success", cost_usd: "0.000010000000000000", input_tokens: 10, total_tokens: 15, request_id: ctx.requestId },
    ]);
  });
});
