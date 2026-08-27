import { z } from "zod";

import { requireUser } from "@/lib/auth/dal";
import {
  getTutorMessages,
  getTutorSession,
  TutorError,
} from "@/lib/tutor/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success)
    return Response.json({ error: "Invalid session ID." }, { status: 400 });
  try {
    const session = await getTutorSession(id.data, user.id);
    return Response.json(
      {
        messages: await getTutorMessages(id.data, user.id),
        readOnly: session.readOnly,
        active: session.active,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof TutorError
            ? error.message
            : "Could not load the conversation.",
      },
      { status: error instanceof TutorError ? error.status : 500 },
    );
  }
}
