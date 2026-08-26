import {
  CHUNK_OVERLAP_TOKENS,
  CHUNK_TARGET_TOKENS,
  MAX_CHUNKS_PER_MATERIAL,
} from "./contracts";

export type SourcePage = {
  pageNumber: number | null;
  text: string;
};

export type ChunkDraft = {
  ordinal: number;
  pageNumber: number | null;
  content: string;
  tokenCount: number;
};

type TextUnit = { content: string; tokenCount: number };

export class MaterialChunkLimitError extends Error {}

export function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function textUnits(text: string): TextUnit[] {
  return (text.match(/\S+\s*/g) ?? []).map((content) => ({
    content,
    tokenCount: estimateTokenCount(content.trimEnd()),
  }));
}

function chunkPage(page: SourcePage): Omit<ChunkDraft, "ordinal">[] {
  const units = textUnits(page.text);
  const chunks: Omit<ChunkDraft, "ordinal">[] = [];
  let start = 0;

  while (start < units.length) {
    let end = start;
    let tokenCount = 0;

    while (end < units.length) {
      const nextCount = units[end].tokenCount;
      if (end > start && tokenCount + nextCount > CHUNK_TARGET_TOKENS) break;
      tokenCount += nextCount;
      end += 1;
    }

    const content = units.slice(start, end).map((unit) => unit.content).join("").trim();
    if (content) chunks.push({ pageNumber: page.pageNumber, content, tokenCount });
    if (end >= units.length) break;

    let nextStart = end;
    let overlap = 0;
    while (nextStart > start && overlap < CHUNK_OVERLAP_TOKENS) {
      nextStart -= 1;
      overlap += units[nextStart].tokenCount;
    }
    start = nextStart === start ? end : nextStart;
  }

  return chunks;
}

export function chunkMaterialPages(pages: SourcePage[]): ChunkDraft[] {
  const chunks = pages.flatMap(chunkPage).map((chunk, ordinal) => ({ ...chunk, ordinal }));

  if (chunks.length > MAX_CHUNKS_PER_MATERIAL) {
    throw new MaterialChunkLimitError(
      `This material produces ${chunks.length} chunks; the limit is ${MAX_CHUNKS_PER_MATERIAL}. Try a shorter document.`,
    );
  }

  return chunks;
}
