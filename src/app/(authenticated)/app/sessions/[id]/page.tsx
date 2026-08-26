import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { TutorChat } from "@/components/tutor/chat";
import { requireUser } from "@/lib/auth/dal";
import { getTutorMessages, getTutorSession, TutorError } from "@/lib/tutor/service";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const session = await getTutorSession(id.data, user.id).catch((error) => {
    if (error instanceof TutorError && error.status === 404) notFound();
    throw error;
  });
  const messages = await getTutorMessages(session.id, user.id);
  return <main className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10">
    <Link href={`/app/courses/${session.courseId}`} className="text-sm text-emerald-700 hover:underline">← {session.courseName}</Link>
    <p className="mt-8 text-sm font-medium text-emerald-700">Socratic tutor</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">{session.lessonTitle}</h1>
    <p className="mt-3 leading-7 text-stone-600">{session.objective}</p>
    <TutorChat key={session.id} sessionId={session.id} initialMessages={messages} initiallyReadOnly={session.readOnly} initiallyActive={session.active} />
    <p className="mt-6 text-xs text-stone-500">Assessment and lesson completion come in the next milestone. Chatting does not mark a lesson complete.</p>
  </main>;
}
