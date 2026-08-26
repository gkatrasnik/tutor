import { db } from "@/db";
import { courses } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { createCourseSchema } from "@/lib/courses/outline";

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = createCourseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid course name." }, { status: 400 });
  const [course] = await db.insert(courses).values({ name: parsed.data.name, ownerId: user.id }).returning({ id: courses.id });
  return Response.json(course, { status: 201 });
}
