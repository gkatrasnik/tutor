import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { DEFAULT_EMBEDDING_MODEL, EmbeddingError } from "../src/lib/rag/embedding-client.mjs";
import { preservationSnapshot, readIndex, reembedIndex } from "./reembed-lib.mjs";
import { trackedEmbeddingClient } from "./embedding-usage.mjs";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !["--dry-run", "--probe", "--apply"].includes(args[0]))) {
    throw new Error("Usage: pnpm embeddings:reembed [--dry-run | --probe | --apply]");
  }
  const mode = args[0] ?? "--dry-run";
  const model = process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const dimensions = Number(process.env.EMBEDDING_DIMENSION ?? 1536);
  if (dimensions !== 1536) throw new Error("EMBEDDING_DIMENSION must be 1536.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  // Use exactly the application's database, not a potentially different unpooled branch.
  const database = neon(process.env.DATABASE_URL);
  const requestId = crypto.randomUUID();
  const clientForOwner = (ownerId) => trackedEmbeddingClient(database, model, dimensions, requestId, ownerId);
  const client = clientForOwner(null);
  console.log(`Model: ${model}; dimensions: ${dimensions}; mode: ${mode}`);

  async function probe() {
    if (!process.env.AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY is required; the CLI does not use implicit deployment credentials.");
    await client.embedQuery("Embedding migration connectivity check.");
    console.log("Gateway probe passed: finite 1536-dimensional vector received.");
  }
  if (mode === "--probe") { await probe(); return; }
  const index = await readIndex(database);
  const pending = index.rows.filter((row) => row.embedding_model !== model);
  console.log(JSON.stringify({ totalChunks: index.rows.length, chunksToReembed: pending.length,
    approximateTokens: pending.reduce((sum, row) => sum + row.token_count, 0) }));
  if (mode !== "--apply") {
    console.log("Read-only preview. --apply calls AI Gateway and atomically replaces embeddings in DATABASE_URL.");
    return;
  }
  if (!pending.length) { console.log("All chunks already use this model; no API calls or writes needed."); return; }
  const before = await preservationSnapshot(database);
  await probe();
  const updated = await reembedIndex({ database, model, dimensions, index, client, clientForOwner,
    onProgress: (done, total) => console.log(`Generated ${done}/${total} replacement embeddings; not committed yet.`) });
  console.log(`Committed ${updated} embedding replacements.`);
  const afterIndex = await readIndex(database);
  const after = await preservationSnapshot(database);
  const preserved = Object.fromEntries(Object.keys(before).map((table) => [table, JSON.stringify(before[table]) === JSON.stringify(after[table])]));
  console.log(JSON.stringify({ totalChunks: afterIndex.rows.length,
    incompatibleChunks: afterIndex.rows.filter((row) => row.embedding_model !== model).length, preserved }));
  if (Object.values(preserved).some((value) => !value) || afterIndex.rows.some((row) => row.embedding_model !== model)) {
    throw new Error("Embedding commit succeeded, but verification detected concurrent changes. Inspect the index before resuming use.");
  }
  console.log("Verified: chunk IDs/content and all course, lesson, session, message, and assessment records are unchanged.");
}

main().catch((error) => {
  // Never dump provider responses, SQL parameters, database URLs, or source text.
  if (error instanceof EmbeddingError) console.error(error.message);
  else if (error?.constraint === "chunks_changed_retry") console.error("Chunks changed during generation. Transaction rolled back; retry when ingestion is idle.");
  else if (error?.code === "42703" || error?.code === "42P01") console.error("Missing embedding or usage schema. Run pnpm db:migrate first.");
  else if (error?.name === "NeonDbError") console.error(`Neon database operation failed (${error.code ?? "connection"}). No partial embedding transaction is committed.`);
  else console.error(error instanceof Error ? error.message : "Re-embedding failed.");
  process.exitCode = 1;
});
