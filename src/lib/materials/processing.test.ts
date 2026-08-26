import type { NeonQueryFunction } from "@neondatabase/serverless";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { materials, type Material } from "../../db/schema";
import type { ChunkDraft } from "../rag/chunking";

type QueryRequest = { sql: string; params: unknown[] };

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(),
  get: vi.fn(),
  chunkMaterialPages: vi.fn(),
  embedDocuments: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({ get: mocks.get, put: vi.fn() }));
vi.mock("unpdf", () => ({ extractText: vi.fn(), getDocumentProxy: vi.fn() }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  // Keep the real HTTP adapter: db.transaction() must still throw in this test.
  // Only replace the Neon transport so tests need no credentials or network.
  const client = { query: mocks.query, transaction: mocks.transaction };
  return { db: drizzle({ client: client as unknown as NeonQueryFunction<false, false> }) };
});
vi.mock("@/lib/rag/chunking", async (importOriginal) => ({
  ...await importOriginal<typeof import("../rag/chunking")>(),
  chunkMaterialPages: mocks.chunkMaterialPages,
}));
vi.mock("@/lib/rag/embeddings", () => ({
  EmbeddingError: class extends Error {},
  embedDocuments: mocks.embedDocuments,
}));

import { processMaterial } from "./processing";

const material: Material = {
  id: "aca9b80d-e56a-4728-b399-c416806b5069",
  courseId: "02564de2-4a8b-4426-8fe2-4e92cc1265ea",
  ownerId: "learner-a",
  sourceType: "text",
  originalFilename: "Notes",
  blobUrl: "https://example.test/notes.txt",
  blobPathname: "materials/learner-a/uploads/notes.txt",
  extractedTextBlobUrl: null,
  extractedTextBlobPathname: null,
  byteSize: 5,
  characterCount: null,
  pageCount: null,
  status: "uploaded",
  processingError: null,
  createdAt: new Date("2026-08-26T00:00:00Z"),
  updatedAt: new Date("2026-08-26T00:00:00Z"),
};

let directQueries: QueryRequest[];

function setChunks(count: number) {
  const chunks: ChunkDraft[] = Array.from({ length: count }, (_, ordinal) => ({
    ordinal, pageNumber: null, content: `Chunk ${ordinal}`, tokenCount: 10,
  }));
  mocks.chunkMaterialPages.mockReturnValue(chunks);
  mocks.embedDocuments.mockResolvedValue(chunks.map((chunk) => Array(1536).fill(chunk.ordinal + 1)));
}

beforeEach(() => {
  vi.resetAllMocks();
  directQueries = [];
  mocks.get.mockResolvedValue({ statusCode: 200, stream: new Response("Notes").body });
  setChunks(1);

  mocks.query.mockImplementation((sql: string, params: unknown[]) => ({
    sql,
    params,
    // Model Neon's lazy queries: constructing a batch query must not execute it.
    then(resolve: (value: { rows: unknown[][] }) => unknown) {
      directQueries.push({ sql, params });
      const owned = params.includes(material.ownerId) && params.includes(material.id);
      const rows = sql.startsWith("select") && owned
        ? [Object.keys(getTableColumns(materials)).map((key) => {
          const value = material[key as keyof Material];
          return value instanceof Date ? value.toISOString() : value;
        })]
        : [];
      return Promise.resolve({ rows }).then(resolve);
    },
  }));
  mocks.transaction.mockImplementation(async (queries: QueryRequest[]) => queries.map(() => ({ rows: [] })));
});

describe("material indexing with the Neon HTTP adapter", () => {
  it("submits delete, chunk inserts, and ready status in one atomic batch", async () => {
    await processMaterial(material.id, material.ownerId);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    const queries = mocks.transaction.mock.calls[0][0] as QueryRequest[];
    expect(queries).toHaveLength(3);
    expect(queries[0].sql).toMatch(/^delete from "material_chunks"/);
    expect(queries[1].sql).toMatch(/^insert into "material_chunks"/);
    expect(queries[2].sql).toMatch(/^update "materials"/);
    expect(queries[2].params).toContain("ready");
    for (const query of [queries[0], queries[2]]) {
      expect(query.sql).toContain('"owner_id"');
      expect(query.params).toContain(material.ownerId);
      expect(query.params).toContain(material.id);
    }
    expect(directQueries).toHaveLength(2); // ownership lookup and processing status only
    expect(directQueries[1].params).toContain("processing");
  });

  it("keeps 25-row insert batches and their embedding offsets aligned", async () => {
    setChunks(51);
    await processMaterial(material.id, material.ownerId);

    const queries = mocks.transaction.mock.calls[0][0] as QueryRequest[];
    const inserts = queries.slice(1, -1);
    expect(inserts.map((query) => query.params.length / 7)).toEqual([25, 25, 1]);
    let ordinal = 0;
    for (const insert of inserts) {
      for (let offset = 0; offset < insert.params.length; offset += 7) {
        expect(insert.params.slice(offset, offset + 7)).toEqual([
          material.id, material.ownerId, ordinal, null, `Chunk ${ordinal}`, 10,
          JSON.stringify(Array(1536).fill(ordinal + 1)),
        ]);
        ordinal += 1;
      }
    }
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(directQueries).toHaveLength(2);
  });

  it("marks a rejected batch failed without exposing database details", async () => {
    mocks.transaction.mockRejectedValue(new Error("private SQL and vector parameters"));

    await expect(processMaterial(material.id, material.ownerId)).rejects.toThrow("search index could not be saved");
    const lastQuery = directQueries.at(-1)!;
    expect(lastQuery.params).toContain("failed");
    expect(lastQuery.params).toContain(material.ownerId);
    expect(lastQuery.params.join(" ")).not.toContain("private SQL");
    expect(directQueries.some((query) => query.params.includes("ready"))).toBe(false);
  });

  it("does no Blob, embedding, or batch work for another user's material", async () => {
    await expect(processMaterial(material.id, "learner-b")).rejects.toThrow("Material not found");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.embedDocuments).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
