import { del, list } from "@vercel/blob";

import { materialUploadPrefix } from "./constants";

type StoredMaterial = {
  id: string;
  blobPathname: string;
  extractedTextBlobPathname: string | null;
};

async function listPaths(prefix: string) {
  const paths: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    paths.push(...page.blobs.map((blob) => blob.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return paths;
}

export async function deleteCourseBlobs(
  ownerId: string,
  courseId: string,
  materials: StoredMaterial[],
) {
  // Include uploads whose database registration never completed.
  const paths = new Set(
    await listPaths(`${materialUploadPrefix(ownerId)}${courseId}/`),
  );
  for (const material of materials) {
    paths.add(material.blobPathname);
    if (material.extractedTextBlobPathname)
      paths.add(material.extractedTextBlobPathname);

    // Extraction can succeed before indexing fails to save this reference.
    // Also cover older retries that used Blob-generated filename suffixes.
    const prefix = `materials/${encodeURIComponent(ownerId)}/extracted/${material.id}`;
    for (const path of await listPaths(prefix)) {
      if (
        path === `${prefix}.txt` ||
        (path.startsWith(`${prefix}-`) && path.endsWith(".txt"))
      )
        paths.add(path);
    }
  }
  // Keep the database references until every deletion has succeeded.
  const allPaths = [...paths];
  for (let offset = 0; offset < allPaths.length; offset += 1000)
    await del(allPaths.slice(offset, offset + 1000));
}
