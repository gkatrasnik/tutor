import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

export function migrationSql(name: string) {
  return readFileSync(resolve("drizzle", name), "utf8");
}

export async function createTestDatabase(includeCourseFirst = true) {
  const pg = new PGlite();
  // These tests exercise relational migrations, not vector search. PGlite's
  // core package has no pgvector: retain embedding data in an array stand-in.
  const initial = migrationSql("0001_initial_schema.sql")
    .replace('"embedding" vector(1536)', '"embedding" real[]')
    .replace(/CREATE INDEX "material_chunks_embedding_hnsw_idx"[^;]+;/, "");
  await pg.exec(initial);
  await pg.exec(migrationSql("0002_aromatic_patch.sql"));
  await pg.exec(migrationSql("0003_course_outlines.sql"));
  if (includeCourseFirst) await pg.exec(migrationSql("0004_course_first_materials.sql"));
  return pg;
}
