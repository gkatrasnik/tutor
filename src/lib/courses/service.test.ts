import type { PGlite } from "@electric-sql/pglite";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDatabase } from "@/db/test-database";
import { outlineFixture, sourceFixture } from "./fixtures.test-support";

const mocks = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), generate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./generation", () => ({ generateCourseOutline: mocks.generate }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  return { db: drizzle({ client: { query: mocks.query, transaction: mocks.transaction } as unknown as NeonQueryFunction<false, false> }) };
});

import { ensureCourseOutline } from "./service";

const courseId = "02564de2-4a8b-4426-8fe2-4e92cc1265ea";
const ownerId = "learner-a";
type Query = { sql: string; params: unknown[]; options: { arrayMode?: boolean } };
let pg: PGlite;

beforeAll(async () => { pg = await createTestDatabase(); }, 30_000);
afterAll(async () => { await pg?.close(); });

beforeEach(async () => {
  vi.resetAllMocks();
  await pg.exec(`TRUNCATE profiles CASCADE;
    INSERT INTO profiles (id, email) VALUES ('learner-a', 'a@example.test'), ('learner-b', 'b@example.test');`);
  await pg.query("INSERT INTO courses (id, owner_id, name) VALUES ($1, $2, $3)", [courseId, ownerId, sourceFixture.courseName]);
  for (const material of sourceFixture.materials) {
    await pg.query(`INSERT INTO materials (id, course_id, owner_id, source_type, original_filename, blob_url, blob_pathname, byte_size, status)
      VALUES ($1::uuid, $2, $3, 'text', $4, 'https://example.test/notes', $1::text, 100, 'ready')`, [material.id, courseId, ownerId, material.filename]);
    for (const chunk of material.chunks) {
      await pg.query(`INSERT INTO material_chunks (material_id, owner_id, ordinal, page_number, content, token_count, embedding)
        VALUES ($1, $2, $3, $4, $5, 10, '{1,2,3}')`, [material.id, ownerId, chunk.ordinal, chunk.pageNumber, chunk.content]);
    }
  }
  mocks.generate.mockResolvedValue(outlineFixture);
  // Keep Drizzle's real Neon HTTP adapter and lazy batch semantics, executing
  // the actual SQL in isolated PostgreSQL instead of calling a remote database.
  mocks.query.mockImplementation((sql: string, params: unknown[], options: Query["options"]) => ({
    sql, params, options,
    then(resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) {
      return pg.query(sql, params, { rowMode: options.arrayMode ? "array" : "object" }).then(resolve, reject);
    },
  }));
  mocks.transaction.mockImplementation(async (queries: Query[]) => pg.transaction(async (tx) => {
    const results = [];
    for (const query of queries) results.push(await tx.query(query.sql, query.params, { rowMode: query.options.arrayMode ? "array" : "object" }));
    return results;
  }));
});

async function course() {
  return (await pg.query<{ status: string; source_version: number; outline_version: number; title: string; generation_error: string | null }>("SELECT * FROM courses WHERE id = $1", [courseId])).rows[0];
}
async function storedLessons() {
  return (await pg.query<{ title: string; ordinal: number }>("SELECT title, ordinal FROM lessons WHERE course_id = $1 ORDER BY ordinal", [courseId])).rows;
}

describe("course-wide generation with Neon HTTP SQL executed in PostgreSQL", () => {
  it("combines both materials and atomically saves ordered lessons", async () => {
    expect(await ensureCourseOutline(courseId, ownerId)).toEqual({ id: courseId, status: "ready" });
    expect(mocks.generate).toHaveBeenCalledExactlyOnceWith(sourceFixture);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(await storedLessons()).toEqual(outlineFixture.lessons.map((lesson, ordinal) => ({ title: lesson.title, ordinal })));
    expect(await course()).toMatchObject({ status: "ready", source_version: 2, outline_version: 2 });
    const queries = mocks.transaction.mock.calls[0][0] as Query[];
    expect(queries).toHaveLength(4);
    expect(queries[0].sql).toContain("for update");
    for (const query of queries) {
      expect(query.sql).toContain('"generation_token"');
      expect(query.sql).toContain('"source_version"');
      expect(query.params).toEqual(expect.arrayContaining([courseId, ownerId]));
    }
  });

  it("returns a current outline without another provider call", async () => {
    await ensureCourseOutline(courseId, ownerId);
    mocks.generate.mockClear();
    await ensureCourseOutline(courseId, ownerId);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("rejects another owner before reading sources or generating", async () => {
    await expect(ensureCourseOutline(courseId, "learner-b")).rejects.toMatchObject({ status: 404 });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("does not include another course's sources, even with the same owner", async () => {
    const other = crypto.randomUUID();
    await pg.query("INSERT INTO courses (id, owner_id, name) VALUES ($1, $2, 'Other')", [other, ownerId]);
    await pg.query("UPDATE materials SET course_id = $1 WHERE id = $2", [other, sourceFixture.materials[1].id]);
    await ensureCourseOutline(courseId, ownerId);
    expect(mocks.generate.mock.calls[0][0].materials).toEqual([sourceFixture.materials[0]]);
  });

  it.each(["uploaded", "processing", "failed"])("blocks generation when any material is %s", async (status) => {
    await pg.query("UPDATE materials SET status = $1 WHERE id = $2", [status, sourceFixture.materials[1].id]);
    await expect(ensureCourseOutline(courseId, ownerId)).rejects.toMatchObject({ status: 409 });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("blocks empty courses and ready materials without chunks", async () => {
    await pg.exec("DELETE FROM material_chunks");
    await expect(ensureCourseOutline(courseId, ownerId)).rejects.toThrow("Every course material");
    await pg.exec("DELETE FROM materials");
    await expect(ensureCourseOutline(courseId, ownerId)).rejects.toThrow("Add at least one");
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("rejects oversized combined sources instead of silently truncating", async () => {
    await pg.query("UPDATE material_chunks SET content = $1", ["x".repeat(100_001)]);
    await expect(ensureCourseOutline(courseId, ownerId)).rejects.toMatchObject({ status: 422 });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("keeps the course and previous outline when a material is deleted, then replaces lessons on update", async () => {
    await ensureCourseOutline(courseId, ownerId);
    await pg.query("DELETE FROM materials WHERE id = $1", [sourceFixture.materials[1].id]);
    expect(await course()).toMatchObject({ source_version: 3, outline_version: 2 });
    expect(await storedLessons()).toHaveLength(4);
    mocks.generate.mockResolvedValue({ ...outlineFixture, lessons: outlineFixture.lessons.slice().reverse() });
    await ensureCourseOutline(courseId, ownerId);
    expect(await course()).toMatchObject({ source_version: 3, outline_version: 3, status: "ready" });
    expect((await storedLessons())[0].title).toBe("Reflection");
    expect(await storedLessons()).toHaveLength(4);
  });

  it("preserves the previous outline when publishing fails", async () => {
    await ensureCourseOutline(courseId, ownerId);
    await pg.exec("UPDATE materials SET status = 'ready'");
    // Deliberately violate a lesson NOT NULL constraint after the batched delete.
    mocks.generate.mockResolvedValue({ ...outlineFixture, lessons: [{ ...outlineFixture.lessons[0], title: null }] });
    await expect(ensureCourseOutline(courseId, ownerId)).rejects.toThrow("Please retry the outline");
    expect(await storedLessons()).toHaveLength(4);
    expect(await course()).toMatchObject({ status: "failed", outline_version: 2 });
  });

  it("rejects a source revision changed during the provider call", async () => {
    mocks.generate.mockImplementation(async () => {
      await pg.query("DELETE FROM materials WHERE id = $1", [sourceFixture.materials[1].id]);
      return outlineFixture;
    });
    await expect(ensureCourseOutline(courseId, ownerId)).rejects.toMatchObject({ status: 409 });
    expect(await storedLessons()).toHaveLength(0);
    expect(await course()).toMatchObject({ status: "failed", outline_version: -1 });
  });

  it("does not duplicate active generation", async () => {
    let release!: (value: typeof outlineFixture) => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    mocks.generate.mockImplementation(() => { started(); return new Promise((resolve) => { release = resolve; }); });
    const first = ensureCourseOutline(courseId, ownerId);
    await startedPromise;
    const second = await ensureCourseOutline(courseId, ownerId);
    expect(second.status).toBe("generating");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    release(outlineFixture);
    await first;
  });

  it("allows retrying an expired claim and fences the stale worker", async () => {
    let release!: (value: typeof outlineFixture) => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    mocks.generate.mockImplementationOnce(() => { started(); return new Promise((resolve) => { release = resolve; }); });
    const first = ensureCourseOutline(courseId, ownerId);
    const staleFailure = expect(first).rejects.toMatchObject({ status: 409 });
    await startedPromise;
    await pg.exec("UPDATE courses SET generation_started_at = now() - interval '6 minutes'");
    mocks.generate.mockResolvedValue({ ...outlineFixture, title: "New outline" });
    await ensureCourseOutline(courseId, ownerId);
    release(outlineFixture);
    await staleFailure;
    expect(await course()).toMatchObject({ status: "ready", title: "New outline", generation_error: null });
  });
});
