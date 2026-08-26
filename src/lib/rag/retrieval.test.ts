import type { NeonQueryFunction } from "@neondatabase/serverless";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), embed: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./embeddings", () => ({ embedQuery: mocks.embed }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  return { db: drizzle({ client: { query: mocks.query } as unknown as NeonQueryFunction<false, false> }) };
});
import { retrieveCourseChunks } from "./retrieval";

beforeEach(() => { vi.resetAllMocks(); mocks.embed.mockResolvedValue(Array(1536).fill(0.1)); mocks.query.mockResolvedValue({ rows: [] }); });

describe("course-wide retrieval SQL", () => {
  it("retrieves the nearest six chunks from the owned course's indexed materials", async () => {
    const signal = AbortSignal.timeout(1000);
    await retrieveCourseChunks({ ownerId: "learner-a", courseId: "course-a", query: "objective and latest message", signal });
    expect(mocks.embed).toHaveBeenCalledExactlyOnceWith("objective and latest message", signal);
    const [sql, params] = mocks.query.mock.calls[0];
    for (const table of ["courses", "materials", "material_chunks"]) expect(sql).toContain(`"${table}"."owner_id"`);
    expect(sql).toContain('"courses"."id" =');
    expect(sql).toContain('"materials"."status" =');
    expect(sql).toContain("<=>");
    expect(sql).toContain("order by");
    expect(params).toEqual(expect.arrayContaining(["learner-a", "course-a", "ready", 6]));
    expect(params.filter((param: unknown) => param === "learner-a")).toHaveLength(3);
  });
});
