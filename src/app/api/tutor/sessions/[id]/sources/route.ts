import { z } from "zod";

import { requireUser } from "@/lib/auth/dal";
import { getMessageSources, TutorError } from "@/lib/tutor/service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const input = z.object({ id: z.uuid(), messageId: z.uuid() }).safeParse({
    id: (await context.params).id,
    messageId: new URL(request.url).searchParams.get("messageId"),
  });
  if (!input.success)
    return Response.json({ error: "Invalid source request." }, { status: 400 });
  try {
    return Response.json(
      await getMessageSources(input.data.id, input.data.messageId, user.id),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof TutorError
            ? error.message
            : "Sources could not be loaded.",
      },
      { status: error instanceof TutorError ? error.status : 500 },
    );
  }
}
