import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const vectorMigration = readFileSync(
  resolve("drizzle/0000_enable_vector.sql"),
  "utf8",
);
const schemaMigration = readFileSync(
  resolve("drizzle/0001_initial_schema.sql"),
  "utf8",
);
const courseMigration = readFileSync(
  resolve("drizzle/0003_course_outlines.sql"),
  "utf8",
);

describe("database migrations", () => {
  it("records the original one-material outline constraints before the course-first migration", () => {
    expect(courseMigration).toContain(
      'CREATE UNIQUE INDEX "courses_material_unique" ON "courses" USING btree ("material_id")',
    );
    expect(courseMigration).toContain(
      'CREATE UNIQUE INDEX "lessons_course_ordinal_unique" ON "lessons" USING btree ("course_id","ordinal")',
    );
  });

  it("records the original cascade before the course-first migration reverses ownership", () => {
    expect(courseMigration).toContain(
      'FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade',
    );
    expect(courseMigration).toContain(
      'FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade',
    );
  });

  it("enables pgvector before creating vector-backed tables", () => {
    expect(vectorMigration).toContain("CREATE EXTENSION IF NOT EXISTS vector");
    expect(schemaMigration).toContain('"embedding" vector(1536) NOT NULL');
  });

  it("creates a cosine HNSW index for retrieval", () => {
    expect(schemaMigration).toContain(
      'USING hnsw ("embedding" vector_cosine_ops)',
    );
  });

  it("stores owner identity directly on chunks for isolated retrieval", () => {
    expect(schemaMigration).toContain(
      '"material_chunks_owner_material_idx" ON "material_chunks" USING btree ("owner_id","material_id")',
    );
  });
});
