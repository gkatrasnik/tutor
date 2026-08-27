import { z } from "zod";

import { requireUser } from "@/lib/auth/dal";
import { startTutorSession, TutorError } from "@/lib/tutor/service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success)
    return Response.json({ error: "Invalid lesson ID." }, { status: 400 });
  try {
    return Response.json(await startTutorSession(id.data, user.id));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof TutorError
            ? error.message
            : "Could not open this lesson.",
      },
      { status: error instanceof TutorError ? error.status : 500 },
    );
  }
}
