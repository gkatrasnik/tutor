import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { courses } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { MAX_PDF_BYTES, materialUploadPrefix } from "@/lib/materials/constants";

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json()) as HandleUploadBody;

  try {
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const parsed = z.object({ courseId: z.uuid() }).safeParse(JSON.parse(clientPayload ?? "null"));
        if (!parsed.success) throw new Error("Choose a course before uploading.");
        const [course] = await db.select({ id: courses.id }).from(courses)
          .where(and(eq(courses.id, parsed.data.courseId), eq(courses.ownerId, user.id))).limit(1);
        if (!course) throw new Error("Course not found.");
        if (!pathname.startsWith(`${materialUploadPrefix(user.id)}${course.id}/`) || !pathname.endsWith(".pdf")) {
          throw new Error("Invalid upload pathname.");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ ownerId: user.id, courseId: course.id }),
        };
      },
    });
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not authorize this upload.";
    return Response.json({ error: message }, { status: 400 });
  }
}
