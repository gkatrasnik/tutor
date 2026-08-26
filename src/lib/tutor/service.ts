import "server-only";

import { and, desc, eq, exists, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { courses, lessonAssessments, lessons, materialChunks, materials, messages, tutorDailyUsage, tutorSessions } from "@/db/schema";
import { TUTOR_DAILY_LIMIT, TUTOR_HISTORY_MESSAGES, TUTOR_LEASE_MS, type ChatMessage } from "./contracts";

export class TutorError extends Error {
  constructor(message: string, public readonly status = 409) { super(message); }
}

export async function getTutorSession(sessionId: string, ownerId: string) {
  const [session] = await db.select({
    id: tutorSessions.id, courseId: tutorSessions.courseId, lessonId: tutorSessions.lessonId,
    lessonTitle: tutorSessions.lessonTitle, objective: tutorSessions.objective, retrievalQuery: tutorSessions.retrievalQuery,
    sourceVersion: tutorSessions.sourceVersion, nextSequence: tutorSessions.nextSequence, activeStartedAt: tutorSessions.activeStartedAt,
    activeToken: tutorSessions.activeToken, courseName: courses.name, courseStatus: courses.status,
    active: sql<boolean>`coalesce(${tutorSessions.activeToken} is not null and ${tutorSessions.activeStartedAt} > now() - ${TUTOR_LEASE_MS} * interval '1 millisecond', false)`,
    currentSourceVersion: courses.sourceVersion, outlineVersion: courses.outlineVersion,
  }).from(tutorSessions).innerJoin(courses, eq(courses.id, tutorSessions.courseId))
    .where(and(eq(tutorSessions.id, sessionId), eq(tutorSessions.ownerId, ownerId), eq(courses.ownerId, ownerId))).limit(1);
  if (!session) throw new TutorError("Session not found.", 404);
  return { ...session, readOnly: !session.lessonId || session.courseStatus !== "ready"
    || session.sourceVersion !== session.currentSourceVersion || session.sourceVersion !== session.outlineVersion };
}

export async function startTutorSession(lessonId: string, ownerId: string) {
  const result = await db.execute(sql`
    insert into ${tutorSessions} (owner_id, course_id, lesson_id, lesson_title, objective, retrieval_query, source_version)
    select ${ownerId}, ${courses.id}, ${lessons.id}, ${lessons.title}, ${lessons.objective}, ${lessons.retrievalQuery}, ${courses.sourceVersion}
    from ${lessons} inner join ${courses} on ${courses.id} = ${lessons.courseId}
    where ${lessons.id} = ${lessonId} and ${lessons.ownerId} = ${ownerId} and ${courses.ownerId} = ${ownerId}
      and ${courses.status} = 'ready' and ${courses.sourceVersion} = ${courses.outlineVersion}
    on conflict (lesson_id) do nothing returning id
  `);
  const insertedId = (result.rows[0] as { id: string } | undefined)?.id;
  const [existing] = insertedId ? [{ id: insertedId }] : await db.select({ id: tutorSessions.id }).from(tutorSessions)
    .where(and(eq(tutorSessions.lessonId, lessonId), eq(tutorSessions.ownerId, ownerId))).limit(1);
  if (!existing) throw new TutorError("Lesson unavailable. Open your course and generate an up-to-date outline first.", 404);
  const session = await getTutorSession(existing.id, ownerId);
  if (session.readOnly) throw new TutorError("This outline changed. Open the course to start a current lesson.");
  return { id: session.id };
}

export async function getTutorMessages(sessionId: string, ownerId: string): Promise<ChatMessage[]> {
  await getTutorSession(sessionId, ownerId);
  const rows = await db.select({ id: messages.id, role: messages.role, status: messages.status, content: messages.content,
    error: messages.error, chunkIds: messages.retrievedChunkIds }).from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.ownerId, ownerId))).orderBy(desc(messages.ordinal)).limit(100);
  return rows.reverse().map(({ chunkIds, ...message }) => ({ ...message, sourceCount: chunkIds.length }));
}

export async function getMessageSources(sessionId: string, messageId: string, ownerId: string) {
  const session = await getTutorSession(sessionId, ownerId);
  const [message] = await db.select({ ids: messages.retrievedChunkIds }).from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.sessionId, sessionId), eq(messages.ownerId, ownerId),
      eq(messages.role, "assistant"), eq(messages.status, "complete"))).limit(1);
  if (!message) throw new TutorError("Answer not found.", 404);
  if (!message.ids.length) return [];
  const rows = await db.select({ id: materialChunks.id, filename: materials.originalFilename,
    pageNumber: materialChunks.pageNumber, ordinal: materialChunks.ordinal, content: materialChunks.content,
  }).from(materialChunks).innerJoin(materials, eq(materials.id, materialChunks.materialId))
    .where(and(inArray(materialChunks.id, message.ids), eq(materialChunks.ownerId, ownerId),
      eq(materials.ownerId, ownerId), eq(materials.courseId, session.courseId)));
  return message.ids.map((id, index) => ({ label: index + 1, source: rows.find((row) => row.id === id) ?? null }));
}

export type PreparedTurn = {
  session: Awaited<ReturnType<typeof getTutorSession>>;
  ownerId: string; token: string; messageId: string; message: string;
  history: { role: "user" | "assistant"; content: string }[];
};

export async function prepareTutorTurn(sessionId: string, ownerId: string, requestId: string, message: string): Promise<PreparedTurn | { replay: string }> {
  const session = await getTutorSession(sessionId, ownerId);
  const prior = await db.select({ id: messages.id, role: messages.role, status: messages.status, content: messages.content }).from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.ownerId, ownerId), eq(messages.requestId, requestId)));
  if (prior.length) {
    if (prior.find((item) => item.role === "user")?.content !== message) throw new TutorError("This request ID was already used for another message.");
    const answer = prior.find((item) => item.role === "assistant");
    if (answer?.status === "complete") return { replay: answer.id };
    throw new TutorError("This message is already processing or its attempt failed. Refresh the conversation before sending it again.");
  }
  if (session.readOnly) throw new TutorError("This session is read-only because the course sources or outline changed. Open a current lesson from the course.");
  const token = crypto.randomUUID();
  const claimed = await db.execute(sql`
    with claimed as (
      update ${tutorSessions} set active_token = ${token}, active_started_at = now(), next_sequence = next_sequence + 2, updated_at = now()
      where id = ${sessionId} and owner_id = ${ownerId} and lesson_id is not null
        and (active_token is null or active_started_at < now() - ${TUTOR_LEASE_MS} * interval '1 millisecond')
        and exists (select 1 from ${courses} where ${courses.id} = ${session.courseId} and ${courses.ownerId} = ${ownerId}
          and ${courses.status} = 'ready' and ${courses.sourceVersion} = ${session.sourceVersion} and ${courses.outlineVersion} = ${session.sourceVersion})
      returning id, next_sequence
    ), interrupted as (
      update ${messages} set status = 'failed', error = 'This response was interrupted. Please send your question again.'
      from claimed where ${messages.sessionId} = claimed.id and ${messages.ownerId} = ${ownerId} and ${messages.status} = 'pending'
    ), interrupted_assessments as (
      update ${lessonAssessments} set status = 'failed', error = 'This assessment was interrupted. Please try again.'
      from claimed where ${lessonAssessments.sessionId} = claimed.id and ${lessonAssessments.ownerId} = ${ownerId} and ${lessonAssessments.status} = 'pending'
    )
    insert into ${messages} (session_id, owner_id, request_id, ordinal, role, status, content)
    select claimed.id, ${ownerId}, ${requestId}::uuid, claimed.next_sequence - 2 + item.position,
      item.role::message_role, item.status::message_status, item.content
    from claimed cross join (values (0, 'user', 'complete', ${message}::text), (1, 'assistant', 'pending', '')) as item(position, role, status, content)
    returning id, role
  `);
  const answer = (claimed.rows as { id: string; role: string }[]).find((row) => row.role === "assistant");
  if (!answer) throw new TutorError("A response or assessment is already running, or the course changed. Refresh and try again; interrupted attempts unlock after two minutes.");
  const turn: PreparedTurn = { session, ownerId, token, messageId: answer.id, message, history: [] };
  try {
    const recent = await db.select({ role: messages.role, content: messages.content }).from(messages)
      .where(and(eq(messages.sessionId, sessionId), eq(messages.ownerId, ownerId), eq(messages.status, "complete"),
        sql`${messages.requestId} <> ${requestId}`, inArray(messages.requestId,
          db.select({ requestId: messages.requestId }).from(messages).where(and(eq(messages.sessionId, sessionId),
            eq(messages.ownerId, ownerId), eq(messages.role, "assistant"), eq(messages.status, "complete"))))))
      .orderBy(desc(messages.ordinal)).limit(TUTOR_HISTORY_MESSAGES);
    turn.history = recent.reverse();
    // Reserve before retrieval (which itself calls the embedding provider).
    const quota = await db.insert(tutorDailyUsage).values({ ownerId, day: sql`(now() at time zone 'UTC')::date::text`, turns: 1 })
      .onConflictDoUpdate({ target: [tutorDailyUsage.ownerId, tutorDailyUsage.day], set: { turns: sql`${tutorDailyUsage.turns} + 1` },
        setWhere: sql`${tutorDailyUsage.turns} < ${TUTOR_DAILY_LIMIT}` }).returning({ day: tutorDailyUsage.day });
    if (!quota.length) throw new TutorError("You have reached today's 30 tutor turns. Please return after midnight UTC.", 429);
    return turn;
  } catch (error) {
    await failTutorTurn(turn, error instanceof TutorError ? error.message : "The conversation could not be prepared. Please try again.");
    throw error;
  }
}

function turnGuard(turn: PreparedTurn) {
  return and(eq(tutorSessions.id, turn.session.id), eq(tutorSessions.ownerId, turn.ownerId), eq(tutorSessions.activeToken, turn.token));
}

export async function failTutorTurn(turn: PreparedTurn, error: string) {
  const guard = turnGuard(turn);
  await db.batch([
    db.execute(sql`select id from ${tutorSessions} where ${guard} for update`),
    db.update(messages).set({ status: "failed", error }).where(and(eq(messages.id, turn.messageId), eq(messages.ownerId, turn.ownerId),
      eq(messages.status, "pending"), exists(db.select({ id: tutorSessions.id }).from(tutorSessions).where(guard)))),
    db.update(tutorSessions).set({ activeToken: null, activeStartedAt: null, updatedAt: sql`now()` }).where(guard),
  ]);
}

export async function completeTutorTurn(turn: PreparedTurn, content: string, chunkIds: string[]) {
  const currentCourse = and(eq(courses.id, turn.session.courseId), eq(courses.ownerId, turn.ownerId), eq(courses.status, "ready"),
    eq(courses.sourceVersion, turn.session.sourceVersion), eq(courses.outlineVersion, turn.session.sourceVersion));
  const guard = and(turnGuard(turn), sql`${tutorSessions.lessonId} is not null`,
    exists(db.select({ id: courses.id }).from(courses).where(currentCourse)));
  const saved = await db.batch([
    db.execute(sql`select id from ${courses} where ${currentCourse} for update`),
    db.execute(sql`select id from ${tutorSessions} where ${guard} for update`),
    db.update(messages).set({ content, retrievedChunkIds: chunkIds, status: "complete", error: null })
      .where(and(eq(messages.id, turn.messageId), eq(messages.ownerId, turn.ownerId), eq(messages.status, "pending"),
        exists(db.select({ id: tutorSessions.id }).from(tutorSessions).where(guard)))).returning({ id: messages.id }),
    db.update(tutorSessions).set({ activeToken: null, activeStartedAt: null, updatedAt: sql`now()` }).where(guard),
  ]);
  if (saved[2].length !== 1) throw new TutorError("The course changed or this response was superseded. The answer was not saved; refresh the conversation.");
}
