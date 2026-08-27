import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ embed: vi.fn(), embedMany: vi.fn() }));
vi.mock("ai", () => mocks);
import {
  createEmbeddingClient,
  DEFAULT_EMBEDDING_MODEL,
  embeddingProviderOptions,
} from "./embedding-client.mjs";

const client = createEmbeddingClient({
  model: DEFAULT_EMBEDDING_MODEL,
  dimensions: 1536,
});
const vector = () => Array(1536).fill(0.1);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.embed.mockResolvedValue({ embedding: vector() });
  mocks.embedMany.mockImplementation(
    async ({ values }: { values: string[] }) => ({
      embeddings: values.map(vector),
    }),
  );
});

describe("OpenAI embedding adapter", () => {
  it("uses the same OpenAI dimensions for documents and queries without Cohere options", async () => {
    await client.embedDocuments(["source"]);
    const signal = AbortSignal.timeout(1000);
    await client.embedQuery("query", signal);
    for (const call of [
      mocks.embed.mock.calls[0][0],
      mocks.embedMany.mock.calls[0][0],
    ]) {
      expect(call.model).toBe(DEFAULT_EMBEDDING_MODEL);
      expect(call.providerOptions).toEqual({ openai: { dimensions: 1536 } });
      expect(call.maxRetries).toBe(0);
    }
    expect(mocks.embed.mock.calls[0][0].abortSignal).toBe(signal);
  });
  it("batches documents sequentially and skips empty work", async () => {
    expect(await client.embedDocuments([])).toEqual([]);
    expect(mocks.embedMany).not.toHaveBeenCalled();
    expect(await client.embedDocuments(Array(51).fill("text"))).toHaveLength(
      51,
    );
    expect(
      mocks.embedMany.mock.calls.map(([args]) => args.values.length),
    ).toEqual([50, 1]);
  });
  it("rejects unsupported models before API work", () => {
    expect(() =>
      embeddingProviderOptions("unknown/model", 1536, "search_query"),
    ).toThrow("Unsupported embedding model");
  });
  it("validates vector dimensions, finite values, and complete batches", async () => {
    mocks.embed.mockResolvedValueOnce({ embedding: [0.1] });
    await expect(client.embedQuery("x")).rejects.toThrow("invalid vector");
    mocks.embed.mockResolvedValueOnce({ embedding: Array(1536).fill(NaN) });
    await expect(client.embedQuery("x")).rejects.toThrow("invalid vector");
    mocks.embedMany.mockResolvedValueOnce({ embeddings: [] });
    await expect(client.embedDocuments(["x"])).rejects.toThrow(
      "incomplete batch",
    );
  });
  it("reports 429 distinctly and retains the original error without leaking its message", async () => {
    const cause = Object.assign(new Error("private provider response"), {
      statusCode: 429,
    });
    mocks.embed.mockRejectedValueOnce(cause);
    await expect(client.embedQuery("x")).rejects.toMatchObject({
      message: expect.stringContaining("429"),
      cause,
    });
    mocks.embedMany.mockRejectedValueOnce(
      new Error("private provider response"),
    );
    await expect(client.embedDocuments(["x"])).rejects.toThrow(
      "Tutor could not index this material through AI Gateway",
    );
  });
});
