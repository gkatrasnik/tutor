import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { courses } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { MAX_PDF_BYTES, materialUploadPrefix } from "@/lib/materials/constants";
import { logServerError } from "@/lib/observability/logger";

class UploadAuthorizationError extends Error {}

function parseClientPayload(value: string | null | undefined) {
  try {
    return JSON.parse(value ?? "null") as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json()) as HandleUploadBody;

  try {
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const parsed = z
          .object({ courseId: z.uuid() })
          .safeParse(parseClientPayload(clientPayload));
        if (!parsed.success)
          throw new UploadAuthorizationError(
            "Choose a course before uploading.",
          );
        const [course] = await db
          .select({ id: courses.id })
          .from(courses)
          .where(
            and(
              eq(courses.id, parsed.data.courseId),
              eq(courses.ownerId, user.id),
            ),
          )
          .limit(1);
        if (!course) throw new UploadAuthorizationError("Course not found.");
        if (
          !pathname.startsWith(
            `${materialUploadPrefix(user.id)}${course.id}/`,
          ) ||
          !pathname.endsWith(".pdf")
        ) {
          throw new UploadAuthorizationError("Invalid upload pathname.");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({
            ownerId: user.id,
            courseId: course.id,
          }),
        };
      },
    });
    return Response.json(response);
  } catch (error) {
    if (!(error instanceof UploadAuthorizationError))
      logServerError("material.upload_authorization.failed", error);
    const message =
      error instanceof UploadAuthorizationError
        ? error.message
        : "Could not authorize this upload.";
    return Response.json(
      { error: message },
      { status: error instanceof UploadAuthorizationError ? 400 : 500 },
    );
  }
}
