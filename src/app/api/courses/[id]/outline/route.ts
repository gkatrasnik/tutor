import { z } from "zod";

import { requireUser } from "@/lib/auth/dal";
import {
  CourseGenerationError,
  ensureCourseOutline,
} from "@/lib/courses/service";
import { logServerError } from "@/lib/observability/logger";
import { enforceAiRateLimit } from "@/lib/usage/rate-limit";
import { aiLimitResponse } from "@/lib/usage/contracts";

export const maxDuration = 120;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success)
    return Response.json({ error: "Invalid course ID." }, { status: 400 });
  try {
    await enforceAiRateLimit(user.id, request);
    const course = await ensureCourseOutline(id.data, user.id);
    return Response.json(course, {
      status: course.status === "generating" ? 202 : 200,
    });
  } catch (error) {
    const limited = aiLimitResponse(error);
    if (limited) return limited;
    if (!(error instanceof CourseGenerationError))
      logServerError("course.outline.failed", error, { courseId: id.data });
    return Response.json(
      {
        error:
          error instanceof CourseGenerationError
            ? error.message
            : "Course generation failed. Please retry.",
      },
      { status: error instanceof CourseGenerationError ? error.status : 500 },
    );
  }
}
