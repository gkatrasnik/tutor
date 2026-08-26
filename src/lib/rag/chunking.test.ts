import { describe, expect, it } from "vitest";

import { CHUNK_OVERLAP_TOKENS, CHUNK_TARGET_TOKENS, MAX_CHUNKS_PER_MATERIAL } from "./contracts";
import { chunkMaterialPages, MaterialChunkLimitError } from "./chunking";

function words(count: number, prefix = "word") {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");
}

describe("material chunking", () => {
  it("creates ordered, overlapping chunks near the target size", () => {
    const chunks = chunkMaterialPages([{ pageNumber: null, text: words(1_000) }]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.ordinal)).toEqual(chunks.map((_, index) => index));
    expect(chunks[0].tokenCount).toBeLessThanOrEqual(CHUNK_TARGET_TOKENS + 5);

    const firstWords = chunks[0].content.split(/\s+/);
    const secondWords = new Set(chunks[1].content.split(/\s+/));
    const sharedTailTokens = firstWords.slice(-CHUNK_OVERLAP_TOKENS).filter((word) => secondWords.has(word));
    expect(sharedTailTokens.length).toBeGreaterThan(0);
  });

  it("keeps PDF page metadata on every chunk", () => {
    const chunks = chunkMaterialPages([
      { pageNumber: 1, text: words(600, "first") },
      { pageNumber: 2, text: words(600, "second") },
    ]);

    expect(new Set(chunks.map((chunk) => chunk.pageNumber))).toEqual(new Set([1, 2]));
    expect(chunks.filter((chunk) => chunk.pageNumber === 1).every((chunk) => chunk.content.includes("first"))).toBe(true);
    expect(chunks.filter((chunk) => chunk.pageNumber === 2).every((chunk) => chunk.content.includes("second"))).toBe(true);
  });

  it("rejects materials above the chunk cap", () => {
    const pages = Array.from({ length: MAX_CHUNKS_PER_MATERIAL + 1 }, (_, index) => ({
      pageNumber: index + 1,
      text: `Page ${index + 1}`,
    }));

    expect(() => chunkMaterialPages(pages)).toThrow(MaterialChunkLimitError);
  });
});
