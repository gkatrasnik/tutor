import "server-only";

import { and, desc, eq, exists, inArray, sql } from "drizzle-orm";
import type { LanguageModel } from "ai";
import { db } from "@/db";
import { courses, lessonAssessments, lessons, messages, tutorSessions } from "@/db/schema";
import { retrieveCourseChunks } from "@/lib/rag/retrieval";
import { TUTOR_LEASE_MS } from "@/lib/tutor/contracts";
import { getTutorSession, TutorError } from "@/lib/tutor/service";
import { ASSESSMENT_HISTORY_MESSAGES, ASSESSMENT_TIMEOUT_MS, COMPLETION_SCORE, assessmentResultSchema, type AssessmentSummary } from "./contracts";
import { generateAssessment } from "./generation";

const HISTORY_PAGE_SIZE = 20;

export async function getAssessmentHistory(sessionId: string, ownerId: string, offset = 0) {
  await getTutorSession(sessionId, ownerId);
  const rows = await db.select({
    id: lessonAssessments.id, status: lessonAssessments.status, score: lessonAssessments.score,
    strengths: lessonAssessments.strengths, gaps: lessonAssessments.gaps, nextStep: lessonAssessments.nextStep,
    error: lessonAssessments.error, createdAt: lessonAssessments.createdAt,
  }).from(lessonAssessments).where(and(eq(lessonAssessments.sessionId, sessionId), eq(lessonAssessments.ownerId, ownerId)))
    .orderBy(desc(lessonAssessments.createdAt), desc(lessonAssessments.id)).limit(HISTORY_PAGE_SIZE + 1).offset(offset);
  return { items: rows.slice(0, HISTORY_PAGE_SIZE).map((row): AssessmentSummary => ({ ...row, createdAt: row.createdAt.toISOString() })), hasMore: rows.length > HISTORY_PAGE_SIZE };
}

// Completion is derived from validated, persisted scores, never from a model's
// suggested action. EXISTS prevents multiple passing attempts double-counting.
export async function getLessonProgress(ownerId: string, courseId?: string) {
  return db.select({ lessonId: lessons.id, courseId: lessons.courseId, completed: sql<boolean>`exists (
    select 1 from ${lessonAssessments} inner join ${tutorSessions} on ${tutorSessions.id} = ${lessonAssessments.sessionId}
    where ${lessonAssessments.ownerId} = ${ownerId} and ${tutorSessions.ownerId} = ${ownerId}
      and ${tutorSessions.lessonId} = ${lessons.id} and ${tutorSessions.courseId} = ${courses.id}
      and ${tutorSessions.sourceVersion} = ${courses.outlineVersion} and ${courses.outlineVersion} = ${courses.sourceVersion}
      and ${courses.status} = 'ready' and ${lessonAssessments.status} = 'complete' and ${lessonAssessments.score} >= ${COMPLETION_SCORE}
  )` }).from(lessons).innerJoin(courses, eq(courses.id, lessons.courseId))
    .where(and(eq(lessons.ownerId, ownerId), eq(courses.ownerId, ownerId), courseId ? eq(courses.id, courseId) : undefined));
}

export async function assessLesson(sessionId: string, ownerId: string, requestId: string, model?: LanguageModel) {
  const session = await getTutorSession(sessionId, ownerId);
  const [prior] = await db.select({ id: lessonAssessments.id, status: lessonAssessments.status }).from(lessonAssessments)
    .where(and(eq(lessonAssessments.sessionId, sessionId), eq(lessonAssessments.ownerId, ownerId), eq(lessonAssessments.requestId, requestId))).limit(1);
  if (prior?.status === "complete") return { id: prior.id };
  if (prior) throw new TutorError("This assessment is running or its attempt failed. Refresh the history before trying again.");
  if (session.readOnly) throw new TutorError("This conversation is read-only. Start a current lesson from the course to be assessed.");
  if (session.active) throw new TutorError("A response or assessment is already running. Refresh shortly.");

  // Only learner messages paired with successful tutor replies are evidence.
  const transcript = (await db.select({ id: messages.id, role: messages.role, content: messages.content, ordinal: messages.ordinal })
    .from(messages).where(and(eq(messages.sessionId, sessionId), eq(messages.ownerId, ownerId), eq(messages.status, "complete"),
      inArray(messages.requestId, db.select({ requestId: messages.requestId }).from(messages)
        .where(and(eq(messages.sessionId, sessionId), eq(messages.ownerId, ownerId), eq(messages.role, "assistant"), eq(messages.status, "complete"))))))
    .orderBy(desc(messages.ordinal)).limit(ASSESSMENT_HISTORY_MESSAGES)).reverse();
  if (transcript.filter((message) => message.role === "user").length < 2) {
    throw new TutorError("Have at least two exchanges with the tutor first, including an answer in your own words.");
  }
  const throughOrdinal = transcript.at(-1)!.ordinal;
  const [existing] = await db.select({ id: lessonAssessments.id }).from(lessonAssessments)
    .where(and(eq(lessonAssessments.sessionId, sessionId), eq(lessonAssessments.ownerId, ownerId),
      eq(lessonAssessments.throughOrdinal, throughOrdinal), eq(lessonAssessments.status, "complete"))).limit(1);
  if (existing) return { id: existing.id };

  const token = crypto.randomUUID();
  // Share the tutor's session lease, so assessment and chat cannot race. The
  // sequence comparison also detects a new turn between reading and claiming.
  const claimed = await db.execute(sql`
    with claimed as (
      update ${tutorSessions} set active_token = ${token}, active_started_at = now(), updated_at = now()
      where id = ${sessionId} and owner_id = ${ownerId} and lesson_id = ${session.lessonId}
        and next_sequence = ${session.nextSequence}
        and (active_token is null or active_started_at < now() - ${TUTOR_LEASE_MS} * interval '1 millisecond')
        and exists (select 1 from ${courses} where ${courses.id} = ${session.courseId} and ${courses.ownerId} = ${ownerId}
          and ${courses.status} = 'ready' and ${courses.sourceVersion} = ${session.sourceVersion} and ${courses.outlineVersion} = ${session.sourceVersion})
        and not exists (select 1 from ${lessonAssessments} where ${lessonAssessments.sessionId} = ${sessionId}
          and ${lessonAssessments.ownerId} = ${ownerId} and (${lessonAssessments.requestId} = ${requestId}
            or (${lessonAssessments.throughOrdinal} = ${throughOrdinal} and ${lessonAssessments.status} = 'complete')))
      returning id
    ), interrupted_messages as (
      update ${messages} set status = 'failed', error = 'This response was interrupted. Please send your question again.'
      from claimed where ${messages.sessionId} = claimed.id and ${messages.ownerId} = ${ownerId} and ${messages.status} = 'pending'
    ), interrupted_assessments as (
      update ${lessonAssessments} set status = 'failed', error = 'This assessment was interrupted. Please try again.'
      from claimed where ${lessonAssessments.sessionId} = claimed.id and ${lessonAssessments.ownerId} = ${ownerId} and ${lessonAssessments.status} = 'pending'
    )
    insert into ${lessonAssessments} (id,session_id,owner_id,request_id,through_ordinal,message_ids)
    select ${token}::uuid, claimed.id, ${ownerId}, ${requestId}::uuid, ${throughOrdinal}, ${JSON.stringify(transcript.map((message) => message.id))}::jsonb from claimed
    returning id
  `);
  if (!claimed.rows.length) throw new TutorError("The conversation changed or another attempt is running. Refresh and try again.");

  const sessionGuard = and(eq(tutorSessions.id, sessionId), eq(tutorSessions.ownerId, ownerId), eq(tutorSessions.activeToken, token));
  const assessmentGuard = and(eq(lessonAssessments.id, token), eq(lessonAssessments.ownerId, ownerId), eq(lessonAssessments.status, "pending"),
    exists(db.select({ id: tutorSessions.id }).from(tutorSessions).where(sessionGuard)));
  try {
    // A claim statement may have waited for a publishing transaction's row
    // lock while retaining its earlier MVCC snapshot. Recheck with a fresh
    // snapshot before any billable work, even after successfully claiming.
    const [published] = await db.select({ id: lessonAssessments.id }).from(lessonAssessments)
      .where(and(eq(lessonAssessments.sessionId, sessionId), eq(lessonAssessments.ownerId, ownerId),
        eq(lessonAssessments.throughOrdinal, throughOrdinal), eq(lessonAssessments.status, "complete"))).limit(1);
    if (published) {
      await db.batch([
        db.execute(sql`select id from ${tutorSessions} where ${sessionGuard} for update`),
        // Discard only this unused claim; no assessment/provider work occurred.
        db.delete(lessonAssessments).where(assessmentGuard),
        db.update(tutorSessions).set({ activeToken: null, activeStartedAt: null, updatedAt: sql`now()` }).where(sessionGuard),
      ]);
      return { id: published.id };
    }
    const signal = AbortSignal.timeout(ASSESSMENT_TIMEOUT_MS);
    const chunks = await retrieveCourseChunks({ ownerId, courseId: session.courseId, query: `${session.objective}\n${session.retrievalQuery}`, signal });
    if (!chunks.length) throw new TutorError("No indexed sources support this assessment. Check the course materials before trying again.");
    const result = assessmentResultSchema.parse(await generateAssessment({
      lesson: { title: session.lessonTitle, objective: session.objective },
      conversation: transcript.map(({ role, content }) => ({ role, content })),
      sources: chunks.map(({ filename, pageNumber, content }) => ({ filename, pageNumber, content })),
    }, signal, model));
    const courseGuard = and(eq(courses.id, session.courseId), eq(courses.ownerId, ownerId), eq(courses.status, "ready"),
      eq(courses.sourceVersion, session.sourceVersion), eq(courses.outlineVersion, session.sourceVersion));
    const current = and(assessmentGuard, exists(db.select({ id: courses.id }).from(courses).where(courseGuard)),
      exists(db.select({ id: tutorSessions.id }).from(tutorSessions).where(and(sessionGuard, eq(tutorSessions.lessonId, session.lessonId!)))));
    const saved = await db.batch([
      db.execute(sql`select id from ${courses} where ${courseGuard} for update`),
      db.execute(sql`select id from ${tutorSessions} where ${sessionGuard} for update`),
      db.update(lessonAssessments).set({ ...result, status: "complete", retrievedChunkIds: chunks.map((chunk) => chunk.id) })
        .where(current).returning({ id: lessonAssessments.id }),
      db.update(tutorSessions).set({ activeToken: null, activeStartedAt: null, updatedAt: sql`now()` }).where(sessionGuard),
    ]);
    if (saved[2].length !== 1) throw new TutorError("The course changed or this attempt was superseded. No completion was recorded; refresh and try again.");
    return { id: token };
  } catch (error) {
    const message = error instanceof TutorError ? error.message : "Could not confirm the assessment. Refresh the history before trying again.";
    // Updating this attempt by its ID is safe even if a newer worker owns the
    // session; releasing the shared lease must still be token-guarded.
    await db.batch([
      db.execute(sql`select id from ${tutorSessions} where ${sessionGuard} for update`),
      db.update(lessonAssessments).set({ status: "failed", error: message }).where(and(eq(lessonAssessments.id, token),
        eq(lessonAssessments.ownerId, ownerId), eq(lessonAssessments.status, "pending"))),
      db.update(tutorSessions).set({ activeToken: null, activeStartedAt: null, updatedAt: sql`now()` }).where(sessionGuard),
    ]);
    throw new TutorError(message, error instanceof TutorError ? error.status : 502);
  }
}
