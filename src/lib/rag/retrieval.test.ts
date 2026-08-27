import type { NeonQueryFunction } from "@neondatabase/serverless";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), embed: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./embeddings", () => ({
  embedQuery: mocks.embed,
  EmbeddingError: class extends Error {},
}));
vi.mock("@/lib/env", () => ({
  env: { EMBEDDING_MODEL: "openai/text-embedding-3-small" },
}));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  return {
    db: drizzle({
      client: { query: mocks.query } as unknown as NeonQueryFunction<
        false,
        false
      >,
    }),
  };
});
import { retrieveCourseChunks, retrieveMaterialChunks } from "./retrieval";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.embed.mockResolvedValue(Array(1536).fill(0.1));
  mocks.query.mockResolvedValue({ rows: [] });
});

describe("course-wide retrieval SQL", () => {
  it("retrieves the nearest six chunks from the owned course's indexed materials", async () => {
    const signal = AbortSignal.timeout(1000);
    await retrieveCourseChunks({
      ownerId: "learner-a",
      courseId: "course-a",
      query: "objective and latest message",
      signal,
    });
    expect(mocks.embed).toHaveBeenCalledExactlyOnceWith(
      "objective and latest message",
      signal,
      { ownerId: "learner-a", requestId: expect.any(String) },
    );
    const [sql, params] = mocks.query.mock.calls[1];
    for (const table of ["courses", "materials", "material_chunks"])
      expect(sql).toContain(`"${table}"."owner_id"`);
    expect(sql).toContain('"courses"."id" =');
    expect(sql).toContain('"materials"."status" =');
    expect(sql).toContain("<=>");
    expect(sql).toContain("order by");
    expect(sql).toContain('"material_chunks"."embedding_model" =');
    expect(params).toContain("openai/text-embedding-3-small");
    expect(params).toEqual(
      expect.arrayContaining(["learner-a", "course-a", "ready", 6]),
    );
    expect(
      params.filter((param: unknown) => param === "learner-a"),
    ).toHaveLength(3);
  });

  it("rejects unknown or incompatible vectors before any embedding request", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [["old-chunk"]] });
    await expect(
      retrieveCourseChunks({
        ownerId: "learner-a",
        courseId: "course-a",
        query: "test",
      }),
    ).rejects.toThrow("embedding migration");
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls[0][0]).toContain("is distinct from");
  });

  it("also guards and filters material-level retrieval", async () => {
    await retrieveMaterialChunks({
      ownerId: "learner-a",
      materialId: "material-a",
      query: "test",
    });
    expect(mocks.query.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        "learner-a",
        "material-a",
        "openai/text-embedding-3-small",
      ]),
    );
    expect(mocks.query.mock.calls[1][0]).toContain(
      '"material_chunks"."embedding_model" =',
    );
  });
});
