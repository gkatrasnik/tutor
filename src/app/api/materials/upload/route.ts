import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { requireUser } from "@/lib/auth/dal";
import { MAX_PDF_BYTES, materialUploadPrefix } from "@/lib/materials/constants";

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json()) as HandleUploadBody;

  try {
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(materialUploadPrefix(user.id)) || !pathname.endsWith(".pdf")) {
          throw new Error("Invalid upload pathname.");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ ownerId: user.id }),
        };
      },
    });
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not authorize this upload.";
    return Response.json({ error: message }, { status: 400 });
  }
}
