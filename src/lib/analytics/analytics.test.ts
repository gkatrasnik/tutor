import type { PGlite } from "@electric-sql/pglite";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createTestDatabase, migrationSql } from "@/db/test-database";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(),
  requireAdmin: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  return {
    db: drizzle({
      client: {
        query: mocks.query,
        transaction: mocks.transaction,
      } as unknown as NeonQueryFunction<false, false>,
    }),
  };
});

import { getAdminAnalytics, getLearnerUsage } from "./service";

type Query = { options: { arrayMode: boolean; fullResults: boolean } };
let pg: PGlite;

beforeAll(async () => {
  pg = await createTestDatabase();
  await pg.exec(migrationSql("0005_tutor_sessions.sql"));
  await pg.exec(migrationSql("0008_usage_accounting.sql"));
}, 30_000);

afterAll(async () => {
  await pg?.close();
});

beforeEach(async () => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    id: "admin",
    email: "admin@example.test",
    name: null,
  });
  mocks.query.mockImplementation(
    (sql: string, params: unknown[], options: Query["options"]) => ({
      sql,
      params,
      options,
      then(
        resolve: (result: unknown) => unknown,
        reject: (error: unknown) => unknown,
      ) {
        return pg
          .query(sql, params, {
            rowMode: options.arrayMode ? "array" : "object",
          })
          .then(resolve, reject);
      },
    }),
  );
  await pg.exec(`
    truncate profiles cascade;
    insert into profiles(id,email) values ('owner','owner@example.test'), ('other','other@example.test');
    insert into tutor_daily_usage(owner_id,day,turns,ingestions)
      values ('owner', (now() at time zone 'UTC')::date::text, 7, 2);
    insert into ai_usage_events(id,owner_id,request_id,feature,model,status,input_tokens,output_tokens,reasoning_tokens,total_tokens,latency_ms,time_to_first_token_ms,cost_usd,error_code,created_at) values
      ('00000000-0000-4000-8000-000000000001','owner','10000000-0000-4000-8000-000000000001','tutor','model-a','success',80,20,5,100,400,120,0.001,null,now()),
      ('00000000-0000-4000-8000-000000000002','owner','10000000-0000-4000-8000-000000000002','embedding','embed-a','failure',20,null,null,20,100,null,null,'provider_rate_limit',now() - interval '1 hour'),
      ('00000000-0000-4000-8000-000000000003','other','10000000-0000-4000-8000-000000000003','assessment','model-a','success',40,10,0,50,300,null,0.002,null,now() - interval '1 day'),
      ('00000000-0000-4000-8000-000000000004','other','10000000-0000-4000-8000-000000000004','outline','old-model','success',900,100,0,1000,999,null,1.0,null,now() - interval '120 days');
  `);
});

describe("learner analytics", () => {
  it("isolates events, omits administrative fields, and reports remaining daily quotas", async () => {
    const result = await getLearnerUsage("owner", 1);
    expect(result.total).toBe(2);
    expect(result.events).toHaveLength(2);
    expect(
      result.events.every(
        (event) => !("model" in event) && !("costUsd" in event),
      ),
    ).toBe(true);
    expect(result.quotas).toEqual({
      tutor: { used: 7, limit: 30, remaining: 23 },
      ingestion: { used: 2, limit: 3, remaining: 1 },
    });
  });
});

describe("admin analytics", () => {
  it("authorizes before returning date-scoped aggregates, breakdowns, costs, and failures", async () => {
    const result = await getAdminAnalytics("30d", 1);
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(result.summary).toMatchObject({
      requests: 3,
      totalTokens: 170,
      errors: 1,
      unknownCosts: 1,
    });
    expect(Number(result.summary.costUsd)).toBeCloseTo(0.003);
    expect(result.byFeature.map((row) => row.feature).sort()).toEqual([
      "assessment",
      "embedding",
      "tutor",
    ]);
    expect(
      result.byModel.find((row) => row.model === "old-model"),
    ).toBeUndefined();
    expect(result.byUser[0]).toMatchObject({
      email: "owner@example.test",
      totalTokens: 120,
    });
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      email: "owner@example.test",
      errorCode: "provider_rate_limit",
    });
    expect(result.requests).toHaveLength(3);
  });

  it("does not query analytics when the admin guard rejects access", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("not admin"));
    mocks.query.mockClear();
    await expect(getAdminAnalytics("7d", 1)).rejects.toThrow("not admin");
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
