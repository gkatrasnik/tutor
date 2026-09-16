import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { list } from "@vercel/blob";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

// Read-only: report file metadata, never file contents or credentials.
const sql = neon(process.env.DATABASE_URL);
const materials = await sql`
  SELECT m.blob_pathname, m.extracted_text_blob_pathname,
    m.original_filename, c.name AS course_name
  FROM materials m JOIN courses c ON c.id = m.course_id
`;
const referenced = new Set(
  materials
    .flatMap((row) => [row.blob_pathname, row.extracted_text_blob_pathname])
    .filter(Boolean),
);
let cursor;
let count = 0;
const unreferenced = [];
do {
  const page = await list({ prefix: "materials/", cursor, limit: 1000 });
  for (const blob of page.blobs) {
    count++;
    if (!referenced.has(blob.pathname)) {
      unreferenced.push({
        pathname: blob.pathname,
        uploadedAt: blob.uploadedAt,
      });
    }
  }
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);
console.log(
  JSON.stringify(
    {
      materialRows: materials.length,
      storedFiles: count,
      registeredMaterials: materials,
      unreferenced,
      note: "Unreferenced files may include uploads or processing still in progress. This audit does not delete anything.",
    },
    null,
    2,
  ),
);
