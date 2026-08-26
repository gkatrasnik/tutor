import { z } from "zod";

import { requireUser } from "@/lib/auth/dal";
import { CourseGenerationError, ensureCourseOutline } from "@/lib/courses/service";

export const maxDuration = 120;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) return Response.json({ error: "Invalid course ID." }, { status: 400 });
  try {
    const course = await ensureCourseOutline(id.data, user.id);
    return Response.json(course, { status: course.status === "generating" ? 202 : 200 });
  } catch (error) {
    return Response.json({ error: error instanceof CourseGenerationError ? error.message : "Course generation failed. Please retry." },
      { status: error instanceof CourseGenerationError ? error.status : 500 });
  }
}
