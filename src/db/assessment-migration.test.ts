import { expect, it } from "vitest";
import { createTestDatabase, migrationSql } from "./test-database";

it("adds assessments while preserving existing courses, materials, lessons, conversations, and messages", async () => {
  const pg = await createTestDatabase();
  try {
    await pg.exec(migrationSql("0005_tutor_sessions.sql"));
    await pg.exec(`
      INSERT INTO profiles(id,email) VALUES ('owner','owner@example.test');
      INSERT INTO courses(id,owner_id,name,status,outline_version) VALUES ('00000000-0000-4000-8000-000000000001','owner','Existing course','ready',0);
      INSERT INTO lessons(id,course_id,owner_id,ordinal,title,objective,concepts,retrieval_query)
        VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','owner',0,'Lesson','Objective','[]','query');
      INSERT INTO materials(course_id,owner_id,source_type,original_filename,blob_url,blob_pathname,byte_size,status)
        VALUES ('00000000-0000-4000-8000-000000000001','owner','text','Notes','private-reference','notes',100,'ready');
      INSERT INTO tutor_sessions(id,owner_id,course_id,lesson_id,lesson_title,objective,retrieval_query,source_version)
        VALUES ('00000000-0000-4000-8000-000000000003','owner','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Lesson','Objective','query',1);
      INSERT INTO messages(session_id,owner_id,request_id,ordinal,role,status,content)
        VALUES ('00000000-0000-4000-8000-000000000003','owner','00000000-0000-4000-8000-000000000004',0,'user','complete','My explanation');
    `);
    const tables = ["courses", "materials", "lessons", "tutor_sessions", "messages"];
    const before = await Promise.all(tables.map(async (table) => (await pg.query(`SELECT * FROM ${table}`)).rows));
    await pg.exec(migrationSql("0006_lesson_assessments.sql"));
    const after = await Promise.all(tables.map(async (table) => (await pg.query(`SELECT * FROM ${table}`)).rows));
    expect(after).toEqual(before);
    expect((await pg.query("SELECT * FROM lesson_assessments")).rows).toEqual([]);
  } finally { await pg.close(); }
}, 30_000);
