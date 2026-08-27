import { expect, it } from "vitest";
import { createTestDatabase, migrationSql } from "./test-database";

it("adds accounting without resetting prior tutor usage or changing source data", async () => {
  const pg = await createTestDatabase();
  try {
    await pg.exec(migrationSql("0005_tutor_sessions.sql"));
    await pg.exec(migrationSql("0006_lesson_assessments.sql"));
    await pg.exec(migrationSql("0007_embedding_model.sql"));
    await pg.exec(`INSERT INTO profiles(id,email) VALUES ('owner','owner@example.test');
      INSERT INTO tutor_daily_usage VALUES ('owner','2026-08-26',17);
      INSERT INTO courses(id,owner_id,name,status) VALUES ('00000000-0000-4000-8000-000000000001','owner','Course','ready');
      INSERT INTO materials(id,course_id,owner_id,source_type,original_filename,blob_url,blob_pathname,byte_size,status)
        VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','owner','text','Notes','private','private',50,'ready');
      INSERT INTO material_chunks(material_id,owner_id,ordinal,content,token_count,embedding,embedding_model)
        VALUES ('00000000-0000-4000-8000-000000000002','owner',0,'Source',1,'{1,2,3}','openai/text-embedding-3-small');`);
    const tables = [
      "courses",
      "materials",
      "material_chunks",
      "lessons",
      "tutor_sessions",
      "messages",
      "lesson_assessments",
    ];
    const before = await Promise.all(
      tables.map(
        async (table) => (await pg.query(`SELECT * FROM ${table}`)).rows,
      ),
    );
    await pg.exec(migrationSql("0008_usage_accounting.sql"));
    const after = await Promise.all(
      tables.map(
        async (table) => (await pg.query(`SELECT * FROM ${table}`)).rows,
      ),
    );
    expect(after).toEqual(before);
    expect((await pg.query("SELECT * FROM tutor_daily_usage")).rows).toEqual([
      { owner_id: "owner", day: "2026-08-26", turns: 17, ingestions: 0 },
    ]);
    expect((await pg.query("SELECT * FROM ai_usage_events")).rows).toEqual([]);
  } finally {
    await pg.close();
  }
}, 30_000);
