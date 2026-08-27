import { describe, expect, it } from "vitest";

import { createTestDatabase, migrationSql } from "./test-database";

describe("course-first migration", () => {
  it("backfills old sources without losing courses, lessons, blobs, or embeddings", async () => {
    const pg = await createTestDatabase(false);
    try {
      await pg.exec(`
        INSERT INTO profiles(id, email) VALUES ('owner', 'owner@example.test');
        INSERT INTO materials(id, owner_id, source_type, original_filename, blob_url, blob_pathname, byte_size, status)
        VALUES ('00000000-0000-4000-8000-000000000001', 'owner', 'text', 'Original notes', 'https://example.test/a', 'a', 10, 'ready'),
          ('00000000-0000-4000-8000-000000000002', 'owner', 'text', 'Unprocessed notes', 'https://example.test/b', 'b', 10, 'uploaded');
        INSERT INTO courses(id, material_id, owner_id, status, title, lesson_count)
        VALUES ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'owner', 'ready', 'Original outline', 1);
        INSERT INTO lessons(course_id, owner_id, ordinal, title, objective, concepts, retrieval_query)
        VALUES ('00000000-0000-4000-8000-000000000003', 'owner', 0, 'Original lesson', 'Objective', '["Concept"]', 'Query');
        INSERT INTO material_chunks(material_id, owner_id, ordinal, content, token_count, embedding)
        VALUES ('00000000-0000-4000-8000-000000000001', 'owner', 0, 'Private source', 3, '{1,2,3}');
      `);
      await pg.exec(migrationSql("0004_course_first_materials.sql"));
      const courses = (
        await pg.query(
          "SELECT name, status, source_version, outline_version FROM courses ORDER BY name",
        )
      ).rows;
      expect(courses).toEqual([
        {
          name: "Original outline",
          status: "ready",
          source_version: 0,
          outline_version: 0,
        },
        {
          name: "Unprocessed notes",
          status: "pending",
          source_version: 0,
          outline_version: -1,
        },
      ]);
      expect((await pg.query("SELECT title FROM lessons")).rows).toEqual([
        { title: "Original lesson" },
      ]);
      expect(
        (await pg.query("SELECT content, embedding FROM material_chunks")).rows,
      ).toEqual([{ content: "Private source", embedding: [1, 2, 3] }]);
      expect(
        (
          await pg.query(
            "SELECT blob_pathname FROM materials WHERE course_id IS NOT NULL ORDER BY blob_pathname",
          )
        ).rows,
      ).toEqual([{ blob_pathname: "a" }, { blob_pathname: "b" }]);
      await pg.exec("DELETE FROM materials WHERE blob_pathname = 'a'");
      expect(
        (
          await pg.query(
            "SELECT name, source_version FROM courses WHERE name = 'Original outline'",
          )
        ).rows,
      ).toEqual([{ name: "Original outline", source_version: 1 }]);
      expect((await pg.query("SELECT title FROM lessons")).rows).toHaveLength(
        1,
      );
    } finally {
      await pg.close();
    }
  }, 30_000);
});
