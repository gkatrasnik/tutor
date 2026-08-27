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
import { createTestDatabase, migrationSql } from "../src/db/test-database";
import {
  createEmbeddingClient,
  DEFAULT_EMBEDDING_MODEL,
} from "../src/lib/rag/embedding-client.mjs";
import {
  preservationSnapshot,
  readIndex,
  reembedIndex,
} from "./reembed-lib.mjs";

let pg: PGlite;
type Query = { sql: string; params: unknown[] };
const transaction = vi.fn();
const database = {
  query: (sql: string, params: unknown[] = []) => ({ sql, params }),
  transaction,
} as unknown as NeonQueryFunction<false, false>;
const owner = "learner-a";
const course = "00000000-0000-4000-8000-000000000001";
const material = "00000000-0000-4000-8000-000000000002";
const lesson = "00000000-0000-4000-8000-000000000003";
const session = "00000000-0000-4000-8000-000000000004";
const chunk = "00000000-0000-4000-8000-000000000005";
const request = "00000000-0000-4000-8000-000000000006";

beforeAll(async () => {
  pg = await createTestDatabase();
  await pg.exec(migrationSql("0005_tutor_sessions.sql"));
  await pg.exec(migrationSql("0006_lesson_assessments.sql"));
  await pg.exec(migrationSql("0007_embedding_model.sql"));
}, 30_000);
afterAll(async () => {
  await pg?.close();
});
beforeEach(async () => {
  vi.resetAllMocks();
  await pg.exec("TRUNCATE profiles CASCADE");
  await pg.query(
    "INSERT INTO profiles(id,email) VALUES ($1,'learner@example.test')",
    [owner],
  );
  await pg.query(
    "INSERT INTO courses(id,owner_id,name,status,outline_version) VALUES ($1,$2,'Course','ready',0)",
    [course, owner],
  );
  await pg.query(
    `INSERT INTO materials(id,course_id,owner_id,source_type,original_filename,blob_url,blob_pathname,byte_size,status)
    VALUES ($1,$2,$3,'text','Notes','private-ref','private-path',100,'ready')`,
    [material, course, owner],
  );
  await pg.query(
    `INSERT INTO material_chunks(id,material_id,owner_id,ordinal,content,token_count,embedding)
    VALUES ($1,$2,$3,0,'Learning through practice',3,'{1,2,3}')`,
    [chunk, material, owner],
  );
  await pg.query(
    `INSERT INTO lessons(id,course_id,owner_id,ordinal,title,objective,concepts,retrieval_query)
    VALUES ($1,$2,$3,0,'Lesson','Objective','[]','query')`,
    [lesson, course, owner],
  );
  await pg.exec("UPDATE courses SET outline_version = source_version");
  await pg.query(
    `INSERT INTO tutor_sessions(id,owner_id,course_id,lesson_id,lesson_title,objective,retrieval_query,source_version)
    VALUES ($1,$2,$3,$4,'Lesson','Objective','query',1)`,
    [session, owner, course, lesson],
  );
  await pg.query(
    `INSERT INTO messages(session_id,owner_id,request_id,ordinal,role,status,content,retrieved_chunk_ids)
    VALUES ($1,$2,$3,0,'assistant','complete','Explanation',$4::jsonb)`,
    [session, owner, request, JSON.stringify([chunk])],
  );
  await pg.query(
    `INSERT INTO lesson_assessments(session_id,owner_id,request_id,through_ordinal,message_ids,retrieved_chunk_ids,status,score,next_step)
    VALUES ($1,$2,$3,0,'[]',$4::jsonb,'complete',80,'Keep practicing')`,
    [session, owner, request, JSON.stringify([chunk])],
  );
  transaction.mockImplementation(async (queries: Query[]) =>
    pg.transaction(async (tx) => {
      const results = [];
      for (const query of queries) {
        // Only the pgvector cast is substituted; real PostgreSQL executes locks,
        // snapshot guard, JSON mapping, UPDATE, and commit/rollback semantics.
        const sql = query.sql.replace(
          "replacement.embedding::vector",
          "ARRAY(SELECT jsonb_array_elements_text(replacement.embedding::jsonb)::real)",
        );
        results.push((await tx.query(sql, query.params)).rows);
      }
      return results;
    }),
  );
});

function client() {
  return {
    ...createEmbeddingClient({
      model: DEFAULT_EMBEDDING_MODEL,
      dimensions: 1536,
    }),
    embedDocuments: vi.fn(async (values: string[]) =>
      values.map(() => Array(1536).fill(0.5)),
    ),
  };
}

describe("atomic embedding-only migration", () => {
  it("labels unknown vectors and preserves IDs, source versions, citations, and completed assessments", async () => {
    const before = await preservationSnapshot(database);
    const index = await readIndex(database);
    expect(index.rows[0].embedding_model).toBeNull();
    expect(
      await reembedIndex({
        database,
        model: DEFAULT_EMBEDDING_MODEL,
        dimensions: 1536,
        index,
        client: client(),
      }),
    ).toBe(1);
    expect(await preservationSnapshot(database)).toEqual(before);
    const { rows } = await pg.query<{
      id: string;
      embedding_model: string;
      embedding: number[];
    }>("SELECT id, embedding_model, embedding FROM material_chunks");
    expect(rows[0]).toMatchObject({
      id: chunk,
      embedding_model: DEFAULT_EMBEDDING_MODEL,
    });
    expect(rows[0].embedding).toHaveLength(1536);
    expect(rows[0].embedding[0]).toBe(0.5);
  });

  it("is idempotent and skips API calls after a successful migration", async () => {
    const api = client();
    await reembedIndex({
      database,
      model: DEFAULT_EMBEDDING_MODEL,
      dimensions: 1536,
      index: await readIndex(database),
      client: api,
    });
    api.embedDocuments.mockClear();
    expect(
      await reembedIndex({
        database,
        model: DEFAULT_EMBEDDING_MODEL,
        dimensions: 1536,
        index: await readIndex(database),
        client: api,
      }),
    ).toBe(0);
    expect(api.embedDocuments).not.toHaveBeenCalled();
  });

  it("leaves the old index intact if the provider fails", async () => {
    const index = await readIndex(database);
    const api = client();
    api.embedDocuments.mockRejectedValue(new Error("429"));
    await expect(
      reembedIndex({
        database,
        model: DEFAULT_EMBEDDING_MODEL,
        dimensions: 1536,
        index,
        client: api,
      }),
    ).rejects.toThrow("429");
    expect(await readIndex(database)).toEqual(index);
  });

  it("rolls back if a chunk changed while embeddings were being generated", async () => {
    const index = await readIndex(database);
    const api = client();
    api.embedDocuments.mockImplementationOnce(async () => {
      await pg.query(
        "UPDATE material_chunks SET content = 'New source' WHERE id = $1",
        [chunk],
      );
      return [Array(1536).fill(0.5)];
    });
    await expect(
      reembedIndex({
        database,
        model: DEFAULT_EMBEDDING_MODEL,
        dimensions: 1536,
        index,
        client: api,
      }),
    ).rejects.toThrow("chunks_changed_retry");
    const { rows } = await pg.query(
      "SELECT content, embedding, embedding_model FROM material_chunks",
    );
    expect(rows[0]).toEqual({
      content: "New source",
      embedding: [1, 2, 3],
      embedding_model: null,
    });
  });

  it("validates the whole batch before any write", async () => {
    const index = await readIndex(database);
    const api = client();
    api.embedDocuments.mockResolvedValueOnce([[1, 2, 3]]);
    await expect(
      reembedIndex({
        database,
        model: DEFAULT_EMBEDDING_MODEL,
        dimensions: 1536,
        index,
        client: api,
      }),
    ).rejects.toThrow("invalid vector");
    expect(await readIndex(database)).toEqual(index);
  });
});
