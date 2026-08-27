import { beforeEach, expect, it, vi } from "vitest";
import type { NeonQueryFunction } from "@neondatabase/serverless";
const mocks = vi.hoisted(() => ({ embed: vi.fn(), embedMany: vi.fn(), record: vi.fn(), observe: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({ embed: mocks.embed, embedMany: mocks.embedMany }));
vi.mock("@/lib/env", () => ({ env: { EMBEDDING_MODEL: "openai/text-embedding-3-small", EMBEDDING_DIMENSION: 1536 } }));
vi.mock("@/lib/usage/gateway", () => ({ recordGateway: mocks.record }));
import { embedDocuments, embedQuery } from "@/lib/rag/embeddings";
import { trackedEmbeddingClient } from "../../../scripts/embedding-usage.mjs";
const context = { ownerId: "owner", requestId: crypto.randomUUID(), reservationId: crypto.randomUUID() };
const metadata = { gateway: { cost: "0.0001" } };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.record.mockImplementation(async (_context, _feature, _model, operation) => operation({ observe: mocks.observe }));
  mocks.embed.mockResolvedValue({ embedding: Array(1536).fill(0.5), usage: { tokens: 2 }, providerMetadata: metadata });
  mocks.embedMany.mockImplementation(async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => Array(1536).fill(0.5)), usage: { tokens: values.length }, providerMetadata: metadata }));
});
it("accounts separately for every document batch and propagates quota attribution", async () => {
  await embedDocuments(Array(51).fill("source"), context);
  expect(mocks.record).toHaveBeenCalledTimes(2);
  for (const args of mocks.record.mock.calls) expect(args.slice(0, 3)).toEqual([context, "embedding", "openai/text-embedding-3-small"]);
  expect(mocks.observe.mock.calls.map(([value]) => value.usage.tokens)).toEqual([50, 1]);
});
it("accounts for query embeddings and forwards cancellation", async () => {
  const signal = AbortSignal.timeout(1000);
  await embedQuery("query", signal, context);
  expect(mocks.record).toHaveBeenCalledTimes(1);
  expect(mocks.embed.mock.calls[0][0].abortSignal).toBe(signal);
  expect(mocks.observe).toHaveBeenCalledWith(expect.objectContaining({ providerMetadata: metadata }));
});
it("never calls the provider if the usage ledger refuses the operation", async () => {
  mocks.record.mockRejectedValueOnce(new Error("Cannot record usage"));
  await expect(embedDocuments(["source"], context)).rejects.toThrow();
  expect(mocks.embedMany).not.toHaveBeenCalled();
});
it("records administrative embeddings against the source owner and synthetic probes without a learner", async () => {
  const query = vi.fn().mockResolvedValue([]);
  const database = { query } as unknown as NeonQueryFunction<false, false>;
  await trackedEmbeddingClient(database, "openai/text-embedding-3-small", 1536, context.requestId, "owner").embedDocuments(["source"]);
  expect(query.mock.calls[0][1]).toEqual([expect.any(String), "owner", context.requestId, "openai/text-embedding-3-small"]);
  expect(query.mock.calls[1][1]).toEqual(expect.arrayContaining(["success", "0.0001", 1]));
  query.mockClear();
  await trackedEmbeddingClient(database, "openai/text-embedding-3-small", 1536, context.requestId, null).embedQuery("synthetic probe");
  expect(query.mock.calls[0][1][1]).toBeNull();
});
