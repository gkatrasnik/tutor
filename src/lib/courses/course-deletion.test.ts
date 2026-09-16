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

import { createTestDatabase } from "@/db/test-database";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  del: vi.fn(),
  list: vi.fn(),
  query: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth/dal", () => ({ requireUser: mocks.user }));
vi.mock("@vercel/blob", () => ({ del: mocks.del, list: mocks.list }));
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

import { DELETE } from "@/app/api/courses/[id]/route";

type Query = {
  sql: string;
  params: unknown[];
  options: { arrayMode?: boolean };
};

const courseId = "02564de2-4a8b-4426-8fe2-4e92cc1265ea";
const otherCourseId = "02564de2-4a8b-4426-8fe2-4e92cc1265eb";
let pg: PGlite;

beforeAll(async () => {
  pg = await createTestDatabase();
}, 30_000);

afterAll(async () => {
  await pg?.close();
});

beforeEach(async () => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "learner-a" });
  mocks.del.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue({ blobs: [], hasMore: false });
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
  mocks.transaction.mockImplementation(async (queries: Query[]) =>
    pg.transaction(async (tx) => {
      const results = [];
      for (const query of queries)
        results.push(
          await tx.query(query.sql, query.params, {
            rowMode: query.options.arrayMode ? "array" : "object",
          }),
        );
      return results;
    }),
  );
  await pg.exec(`
    TRUNCATE profiles CASCADE;
    INSERT INTO profiles (id, email) VALUES
      ('learner-a', 'a@example.test'), ('learner-b', 'b@example.test');
    INSERT INTO courses (id, owner_id, name) VALUES
      ('${courseId}', 'learner-a', 'Delete me'),
      ('${otherCourseId}', 'learner-b', 'Keep me');
    INSERT INTO materials
      (id, course_id, owner_id, source_type, original_filename, blob_url,
       blob_pathname, extracted_text_blob_pathname, byte_size, status)
    VALUES
      ('10000000-0000-4000-8000-000000000001', '${courseId}', 'learner-a',
       'pdf', 'notes.pdf', 'https://example.test/notes', 'uploads/notes.pdf',
       'extracted/notes.txt', 100, 'ready'),
      ('10000000-0000-4000-8000-000000000002', '${otherCourseId}', 'learner-b',
       'text', 'keep.txt', 'https://example.test/keep', 'uploads/keep.txt',
       'uploads/keep.txt', 100, 'ready');
  `);
});

function request(id: string) {
  return DELETE(new Request(`http://localhost/api/courses/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("course deletion route", () => {
  it("cleans up unregistered course uploads and unrecorded extraction files across pages", async () => {
    const upload = `materials/learner-a/uploads/${courseId}/unregistered.pdf`;
    const extracted =
      "materials/learner-a/extracted/10000000-0000-4000-8000-000000000001.txt";
    mocks.list
      .mockResolvedValueOnce({
        blobs: [{ pathname: upload }],
        hasMore: true,
        cursor: "page-2",
      })
      .mockResolvedValueOnce({
        blobs: [{ pathname: `${upload}.txt` }],
        hasMore: false,
      })
      .mockResolvedValueOnce({
        blobs: [{ pathname: extracted }],
        hasMore: false,
      });
    expect((await request(courseId)).status).toBe(200);
    expect(mocks.list).toHaveBeenNthCalledWith(2, {
      prefix: `materials/learner-a/uploads/${courseId}/`,
      cursor: "page-2",
      limit: 1000,
    });
    expect(mocks.del).toHaveBeenCalledWith(
      expect.arrayContaining([upload, `${upload}.txt`, extracted]),
    );
  });

  it.each(["list", "del"] as const)(
    "retains course and material records if Blob %s fails",
    async (operation) => {
      mocks[operation].mockRejectedValue(new Error("Storage unavailable"));
      expect((await request(courseId)).status).toBe(502);
      expect((await pg.query("SELECT id FROM courses")).rows).toHaveLength(2);
      expect((await pg.query("SELECT id FROM materials")).rows).toHaveLength(2);
    },
  );

  it("deletes only the authenticated owner's course and its private blobs", async () => {
    const response = await request(courseId);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.del).toHaveBeenCalledExactlyOnceWith([
      "uploads/notes.pdf",
      "extracted/notes.txt",
    ]);
    expect(
      (await pg.query("SELECT name FROM courses ORDER BY name")).rows,
    ).toEqual([{ name: "Keep me" }]);
    expect(
      (await pg.query("SELECT original_filename FROM materials")).rows,
    ).toEqual([{ original_filename: "keep.txt" }]);
  });

  it("does not expose or delete another learner's course", async () => {
    const response = await request(otherCourseId);

    expect(response.status).toBe(404);
    expect(mocks.del).not.toHaveBeenCalled();
    expect((await pg.query("SELECT id FROM courses")).rows).toHaveLength(2);
  });

  it("rejects malformed IDs before database or blob work", async () => {
    const response = await request("bad");

    expect(response.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });
});
