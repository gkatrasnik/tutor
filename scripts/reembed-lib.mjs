import { createEmbeddingClient, validateEmbedding, EMBEDDING_BATCH_SIZE } from "../src/lib/rag/embedding-client.mjs";

export const MAX_REEMBED_CHUNKS = 2000;
// Include vectors and labels, so a concurrent re-embedding also invalidates the snapshot.
export const INDEX_FINGERPRINT_SQL = `SELECT md5(COALESCE(jsonb_agg(to_jsonb(c) ORDER BY id)::text, '[]')) AS fingerprint FROM material_chunks c`;
export const CHUNK_METADATA_SQL = `SELECT md5(COALESCE(jsonb_agg(to_jsonb(c) - 'embedding' - 'embedding_model' ORDER BY id)::text, '[]')) AS fingerprint FROM material_chunks c`;

/** @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} database */
export async function readIndex(database) {
  // One read-only transaction gives rows and fingerprint the same snapshot.
  const [rows, fingerprint] = await database.transaction([
    database.query(`SELECT id, content, token_count, embedding_model FROM material_chunks ORDER BY id LIMIT ${MAX_REEMBED_CHUNKS + 1}`),
    database.query(INDEX_FINGERPRINT_SQL),
  ], { isolationLevel: "RepeatableRead", readOnly: true });
  if (rows.length > MAX_REEMBED_CHUNKS) throw new Error(`This atomic MVP migration is limited to ${MAX_REEMBED_CHUNKS} chunks. Use a staged migration for a larger index.`);
  return { rows, fingerprint: fingerprint[0].fingerprint };
}

/** @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} database */
export async function preservationSnapshot(database) {
  // Only hashes/counts leave the database. No private content is logged or saved.
  const tables = ["courses", "materials", "lessons", "tutor_sessions", "messages", "lesson_assessments"];
  const queries = tables.map((table) => database.query(
    `SELECT count(*)::int AS count, md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text, '[]')) AS fingerprint FROM ${table} t`,
  ));
  const results = await database.transaction([...queries, database.query(CHUNK_METADATA_SQL)],
    { isolationLevel: "RepeatableRead", readOnly: true });
  return Object.fromEntries([...tables, "chunk_metadata"].map((table, index) => [table, results[index][0]]));
}

/**
 * Generate every replacement before taking a short database write lock. The
 * snapshot guard and all updates commit together: a crash/provider error/stale
 * snapshot never leaves a partially replaced index. No material status writes.
 * @param {{ database: import('@neondatabase/serverless').NeonQueryFunction<false, false>, model: string, dimensions: number,
 *   index: Awaited<ReturnType<typeof readIndex>>, onProgress?: (done: number, total: number) => void,
 *   client?: ReturnType<typeof createEmbeddingClient> }} options
 */
export async function reembedIndex({ database, model, dimensions, index, onProgress = () => {},
  client = createEmbeddingClient({ model, dimensions }) }) {
  if (dimensions !== 1536) throw new Error("The database vector dimension must remain 1536.");
  const pending = index.rows.filter((row) => row.embedding_model !== model);
  if (pending.length === 0) return 0;
  const replacements = [];
  for (let start = 0; start < pending.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = pending.slice(start, start + EMBEDDING_BATCH_SIZE);
    const embeddings = await client.embedDocuments(batch.map((row) => row.content));
    if (embeddings.length !== batch.length) throw new Error("Incomplete embedding batch; no database writes were made.");
    replacements.push(...batch.map((row, i) => ({ id: row.id, embedding: JSON.stringify(validateEmbedding(embeddings[i], dimensions)) })));
    onProgress(replacements.length, pending.length);
  }
  const result = await database.transaction([
    database.query("SET LOCAL lock_timeout = '5s'"),
    database.query("SET LOCAL statement_timeout = '30s'"),
    database.query("LOCK TABLE material_chunks IN SHARE ROW EXCLUSIVE MODE"),
    database.query("CREATE TEMP TABLE embedding_snapshot_guard (unchanged boolean CONSTRAINT chunks_changed_retry CHECK (unchanged)) ON COMMIT DROP"),
    database.query(`INSERT INTO embedding_snapshot_guard SELECT fingerprint = $1 FROM (${INDEX_FINGERPRINT_SQL}) snapshot`, [index.fingerprint]),
    database.query(`UPDATE material_chunks AS c SET embedding = replacement.embedding::vector, embedding_model = $2
      FROM jsonb_to_recordset($1::jsonb) AS replacement(id uuid, embedding text)
      WHERE c.id = replacement.id RETURNING c.id`, [JSON.stringify(replacements), model]),
  ]);
  return result[5].length;
}
