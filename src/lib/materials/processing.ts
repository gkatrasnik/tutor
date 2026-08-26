import "server-only";

import { get, put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { extractText, getDocumentProxy } from "unpdf";

import { db } from "@/db";
import { materialChunks, materials } from "@/db/schema";
import { env } from "@/lib/env";
import { chunkMaterialPages, MaterialChunkLimitError, type SourcePage } from "@/lib/rag/chunking";
import { EmbeddingError, embedDocuments } from "@/lib/rag/embeddings";

import { MAX_PDF_PAGES, MAX_TEXT_CHARACTERS } from "./constants";
import { normalizeExtractedText } from "./validation";

export class MaterialProcessingError extends Error {}

async function readPrivateBlob(pathname: string) {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200) {
    throw new MaterialProcessingError("The uploaded file could not be read. Please upload it again.");
  }
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}

function safeProcessingMessage(error: unknown) {
  if (error instanceof MaterialProcessingError) return error.message;
  if (error instanceof MaterialChunkLimitError || error instanceof EmbeddingError) return error.message;
  return "We could not read this file. It may be encrypted or malformed.";
}

const CHUNK_INSERT_BATCH_SIZE = 25;

export async function processMaterial(materialId: string, ownerId: string) {
  const [material] = await db.select().from(materials)
    .where(and(eq(materials.id, materialId), eq(materials.ownerId, ownerId))).limit(1);

  if (!material) throw new MaterialProcessingError("Material not found.");

  await db.update(materials).set({ status: "processing", processingError: null, updatedAt: new Date() })
    .where(and(eq(materials.id, materialId), eq(materials.ownerId, ownerId)));

  try {
    const bytes = await readPrivateBlob(material.blobPathname);
    let text: string;
    let sourcePages: SourcePage[];
    let pageCount: number | null = null;
    let extractedTextBlobUrl = material.blobUrl;
    let extractedTextBlobPathname = material.blobPathname;

    if (material.sourceType === "pdf") {
      let document: Awaited<ReturnType<typeof getDocumentProxy>>;
      try {
        document = await getDocumentProxy(bytes);
      } catch {
        throw new MaterialProcessingError("This PDF is encrypted or malformed and cannot be read.");
      }

      pageCount = document.numPages;
      if (pageCount > MAX_PDF_PAGES) {
        throw new MaterialProcessingError(`PDFs are limited to ${MAX_PDF_PAGES} pages.`);
      }

      const extracted = await extractText(document, { mergePages: false });
      sourcePages = extracted.text.map((pageText, index) => ({
        pageNumber: index + 1,
        text: normalizeExtractedText(pageText),
      }));
      text = normalizeExtractedText(sourcePages.map((page) => page.text).join("\n\n"));

      if (!text) {
        throw new MaterialProcessingError("No readable text was found. Image-only scans are not supported yet.");
      }
      if (text.length > MAX_TEXT_CHARACTERS) {
        throw new MaterialProcessingError(
          `Extracted text exceeds the ${MAX_TEXT_CHARACTERS.toLocaleString()} character limit.`,
        );
      }

      const extractedBlob = await put(
        `materials/${encodeURIComponent(ownerId)}/extracted/${material.id}.txt`,
        text,
        { access: "private", contentType: "text/plain; charset=utf-8", allowOverwrite: true },
      );
      extractedTextBlobUrl = extractedBlob.url;
      extractedTextBlobPathname = extractedBlob.pathname;
    } else {
      text = normalizeExtractedText(new TextDecoder().decode(bytes));
      if (!text) throw new MaterialProcessingError("The pasted text is empty.");
      sourcePages = [{ pageNumber: null, text }];
    }

    const chunks = chunkMaterialPages(sourcePages);
    const embeddings = await embedDocuments(chunks.map((chunk) => chunk.content));

    try {
      // Neon HTTP cannot run interactive transaction callbacks. Build every
      // statement without awaiting it, then submit one atomic HTTP transaction.
      const writes: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [
        db.delete(materialChunks).where(and(
          eq(materialChunks.materialId, materialId),
          eq(materialChunks.ownerId, ownerId),
        )),
      ];

      for (let start = 0; start < chunks.length; start += CHUNK_INSERT_BATCH_SIZE) {
        const batch = chunks.slice(start, start + CHUNK_INSERT_BATCH_SIZE);
        writes.push(db.insert(materialChunks).values(batch.map((chunk, index) => ({
          materialId,
          ownerId,
          ordinal: chunk.ordinal,
          pageNumber: chunk.pageNumber,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embedding: embeddings[start + index],
          embeddingModel: env.EMBEDDING_MODEL,
        }))));
      }

      writes.push(db.update(materials).set({
        status: "ready",
        processingError: null,
        pageCount,
        characterCount: text.length,
        extractedTextBlobUrl,
        extractedTextBlobPathname,
        updatedAt: new Date(),
      }).where(and(eq(materials.id, materialId), eq(materials.ownerId, ownerId))));

      await db.batch(writes);
    } catch (error) {
      throw new MaterialProcessingError(
        "The material was read, but its search index could not be saved. Please retry.",
        { cause: error },
      );
    }
  } catch (error) {
    const message = safeProcessingMessage(error);
    await db.update(materials).set({ status: "failed", processingError: message, updatedAt: new Date() })
      .where(and(eq(materials.id, materialId), eq(materials.ownerId, ownerId)));
    throw new MaterialProcessingError(message, { cause: error });
  }
}
