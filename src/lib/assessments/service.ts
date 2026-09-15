import "server-only";

import { and, desc, eq, exists, sql } from "drizzle-orm";
import type { LanguageModel } from "ai";
import { db } from "@/db";
import {
  courses,
  lessonAssessments,
  lessons,
  messages,
  tutorSessions,
} from "@/db/schema";
import { logServerError } from "@/lib/observability/logger";
import { retrieveCourseChunks } from "@/lib/rag/retrieval";
import { TUTOR_LEASE_MS } from "@/lib/tutor/contracts";
import { getTutorSession, TutorError } from "@/lib/tutor/service";
import {
  ASSESSMENT_TIMEOUT_MS,
  COMPLETION_SCORE,
  quizSchema,
  publicQuiz,
  gradeQuiz,
  quizReview,
  type AssessmentSummary,
} from "./contracts";
import { generateAssessment } from "./generation";

const HISTORY_PAGE_SIZE = 20;

export async function getAssessmentHistory(
  sessionId: string,
  ownerId: string,
  offset = 0,
) {
  await getTutorSession(sessionId, ownerId);
  const rows = await db
    .select({
      id: lessonAssessments.id,
      status: lessonAssessments.status,
      score: lessonAssessments.score,
      strengths: lessonAssessments.strengths,
      gaps: lessonAssessments.gaps,
      nextStep: lessonAssessments.nextStep,
      error: lessonAssessments.error,
      createdAt: lessonAssessments.createdAt,
      quiz: lessonAssessments.quiz,
      answers: lessonAssessments.answers,
    })
    .from(lessonAssessments)
    .where(
      and(
        eq(lessonAssessments.sessionId, sessionId),
        eq(lessonAssessments.ownerId, ownerId),
      ),
    )
    .orderBy(desc(lessonAssessments.createdAt), desc(lessonAssessments.id))
    .limit(HISTORY_PAGE_SIZE + 1)
    .offset(offset);
  return {
    items: rows.slice(0, HISTORY_PAGE_SIZE).map((row): AssessmentSummary => ({
      id: row.id,
      status: row.status,
      score: row.score,
      strengths: row.strengths,
      gaps: row.gaps,
      nextStep: row.nextStep,
      error: row.error,
      review:
        row.status === "complete" && row.quiz && row.answers
          ? quizReview(row.quiz, row.answers)
          : null,
      passingScore: row.quiz ? COMPLETION_SCORE : 70,
      quiz:
        row.quiz && row.status === "pending"
          ? publicQuiz(row.id, row.quiz)
          : null,
      createdAt: row.createdAt.toISOString(),
    })),
    hasMore: rows.length > HISTORY_PAGE_SIZE,
  };
}

// Completion is derived from validated, persisted scores, never from a model's
// suggested action. EXISTS prevents multiple passing attempts double-counting.
export async function getLessonProgress(ownerId: string, courseId?: string) {
  return db
    .select({
      lessonId: lessons.id,
      courseId: lessons.courseId,
      completed: sql<boolean>`exists (
    select 1 from ${lessonAssessments} inner join ${tutorSessions} on ${tutorSessions.id} = ${lessonAssessments.sessionId}
    where ${lessonAssessments.ownerId} = ${ownerId} and ${tutorSessions.ownerId} = ${ownerId}
      and ${tutorSessions.lessonId} = ${lessons.id} and ${tutorSessions.courseId} = ${courses.id}
      and ${tutorSessions.sourceVersion} = ${courses.outlineVersion} and ${courses.outlineVersion} = ${courses.sourceVersion}
      and ${courses.status} = 'ready' and ${lessonAssessments.status} = 'complete' and ${lessonAssessments.score} >= case when ${lessonAssessments.quiz} is null then 70 else ${COMPLETION_SCORE} end
  )`,
    })
    .from(lessons)
    .innerJoin(courses, eq(courses.id, lessons.courseId))
    .where(
      and(
        eq(lessons.ownerId, ownerId),
        eq(courses.ownerId, ownerId),
        courseId ? eq(courses.id, courseId) : undefined,
      ),
    );
}

export async function assessLesson(
  sessionId: string,
  ownerId: string,
  requestId: string,
  model?: LanguageModel,
) {
  const session = await getTutorSession(sessionId, ownerId);
  const [prior] = await db
    .select({
      id: lessonAssessments.id,
      status: lessonAssessments.status,
      quiz: lessonAssessments.quiz,
    })
    .from(lessonAssessments)
    .where(
      and(
        eq(lessonAssessments.sessionId, sessionId),
        eq(lessonAssessments.ownerId, ownerId),
        eq(lessonAssessments.requestId, requestId),
      ),
    )
    .limit(1);
  if (session.readOnly)
    throw new TutorError("This lesson has changed. Start a current lesson.");
  if (prior?.quiz && prior.status === "pending")
    return publicQuiz(prior.id, prior.quiz);
  if (prior)
    throw new TutorError(
      "This assessment is running or its attempt failed. Refresh the history before trying again.",
    );
  if (session.active)
    throw new TutorError(
      "A response or assessment is already running. Refresh shortly.",
    );

  if (
    !session.lessonPlan ||
    session.completedChunks !== session.lessonPlan.chunks.length
  )
    throw new TutorError(
      "Answer the short question for every lesson part before taking the test.",
    );
  const [ready] = await db
    .select({ id: lessonAssessments.id, quiz: lessonAssessments.quiz })
    .from(lessonAssessments)
    .where(
      and(
        eq(lessonAssessments.sessionId, sessionId),
        eq(lessonAssessments.ownerId, ownerId),
        eq(lessonAssessments.status, "pending"),
        sql`${lessonAssessments.quiz} is not null`,
      ),
    )
    .limit(1);
  if (ready?.quiz) return publicQuiz(ready.id, ready.quiz);
  const throughOrdinal = Math.max(0, session.nextSequence - 1);
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
            or (${lessonAssessments.quiz} is not null and ${lessonAssessments.status} = 'pending')))
      returning id
    ), interrupted_messages as (
      update ${messages} set status = 'failed', error = 'This response was interrupted. Please send your question again.'
      from claimed where ${messages.sessionId} = claimed.id and ${messages.ownerId} = ${ownerId} and ${messages.status} = 'pending'
    ), interrupted_assessments as (
      update ${lessonAssessments} set status = 'failed', error = 'This assessment was interrupted. Please try again.'
      from claimed where ${lessonAssessments.sessionId} = claimed.id and ${lessonAssessments.ownerId} = ${ownerId} and ${lessonAssessments.status} = 'pending' and ${lessonAssessments.quiz} is null
    )
    insert into ${lessonAssessments} (id,session_id,owner_id,request_id,through_ordinal,message_ids)
    select ${token}::uuid, claimed.id, ${ownerId}, ${requestId}::uuid, ${throughOrdinal}, ${JSON.stringify([])}::jsonb from claimed
    returning id
  `);
  if (!claimed.rows.length)
    throw new TutorError(
      "The conversation changed or another attempt is running. Refresh and try again.",
    );

  const sessionGuard = and(
    eq(tutorSessions.id, sessionId),
    eq(tutorSessions.ownerId, ownerId),
    eq(tutorSessions.activeToken, token),
  );
  const assessmentGuard = and(
    eq(lessonAssessments.id, token),
    eq(lessonAssessments.ownerId, ownerId),
    eq(lessonAssessments.status, "pending"),
    exists(
      db
        .select({ id: tutorSessions.id })
        .from(tutorSessions)
        .where(sessionGuard),
    ),
  );
  try {
    // A competing generation may have published while this claim waited for
    // the session lock. Recheck with a fresh snapshot before billable work.
    const [published] = await db
      .select({ id: lessonAssessments.id, quiz: lessonAssessments.quiz })
      .from(lessonAssessments)
      .where(
        and(
          eq(lessonAssessments.sessionId, sessionId),
          eq(lessonAssessments.ownerId, ownerId),
          eq(lessonAssessments.status, "pending"),
          sql`${lessonAssessments.quiz} is not null`,
        ),
      )
      .limit(1);
    if (published?.quiz) {
      await db.batch([
        db.execute(
          sql`select id from ${tutorSessions} where ${sessionGuard} for update`,
        ),
        db.delete(lessonAssessments).where(assessmentGuard),
        db
          .update(tutorSessions)
          .set({
            activeToken: null,
            activeStartedAt: null,
            updatedAt: sql`now()`,
          })
          .where(sessionGuard),
      ]);
      return publicQuiz(published.id, published.quiz);
    }
    const signal = AbortSignal.timeout(ASSESSMENT_TIMEOUT_MS);
    const usage = { ownerId, requestId };
    const chunks =
      session.lessonPlan.sources ??
      (await retrieveCourseChunks({
        ownerId,
        courseId: session.courseId,
        query: `${session.objective}\n${session.retrievalQuery}`,
        signal,
        usage,
      }));
    if (!chunks.length)
      throw new TutorError(
        "No indexed sources support this assessment. Check the course materials before trying again.",
      );
    const result = quizSchema.parse(
      await generateAssessment(
        {
          lesson: { title: session.lessonTitle, objective: session.objective },
          chunks: session.lessonPlan.chunks,
          sources: chunks.map(({ filename, pageNumber, content }) => ({
            filename,
            pageNumber,
            content,
          })),
        },
        signal,
        usage,
        model,
      ),
    );
    const courseGuard = and(
      eq(courses.id, session.courseId),
      eq(courses.ownerId, ownerId),
      eq(courses.status, "ready"),
      eq(courses.sourceVersion, session.sourceVersion),
      eq(courses.outlineVersion, session.sourceVersion),
    );
    const current = and(
      assessmentGuard,
      exists(db.select({ id: courses.id }).from(courses).where(courseGuard)),
      exists(
        db
          .select({ id: tutorSessions.id })
          .from(tutorSessions)
          .where(
            and(sessionGuard, eq(tutorSessions.lessonId, session.lessonId!)),
          ),
      ),
    );
    const saved = await db.batch([
      db.execute(
        sql`select id from ${courses} where ${courseGuard} for update`,
      ),
      db.execute(
        sql`select id from ${tutorSessions} where ${sessionGuard} for update`,
      ),
      db
        .update(lessonAssessments)
        .set({
          quiz: result,
          retrievedChunkIds: chunks.map((chunk) => chunk.id),
        })
        .where(current)
        .returning({ id: lessonAssessments.id }),
      db
        .update(tutorSessions)
        .set({
          activeToken: null,
          activeStartedAt: null,
          updatedAt: sql`now()`,
        })
        .where(sessionGuard),
    ]);
    if (saved[2].length !== 1)
      throw new TutorError(
        "The course changed or this attempt was superseded. No completion was recorded; refresh and try again.",
      );
    return publicQuiz(token, result);
  } catch (error) {
    if (!(error instanceof TutorError))
      logServerError("assessment.generation.failed", error, {
        sessionId,
        assessmentId: token,
      });
    const message =
      error instanceof TutorError
        ? error.message
        : "Could not confirm the assessment. Refresh the history before trying again.";
    // Updating this attempt by its ID is safe even if a newer worker owns the
    // session; releasing the shared lease must still be token-guarded.
    await db.batch([
      db.execute(
        sql`select id from ${tutorSessions} where ${sessionGuard} for update`,
      ),
      db
        .update(lessonAssessments)
        .set({ status: "failed", error: message })
        .where(
          and(
            eq(lessonAssessments.id, token),
            eq(lessonAssessments.ownerId, ownerId),
            eq(lessonAssessments.status, "pending"),
          ),
        ),
      db
        .update(tutorSessions)
        .set({
          activeToken: null,
          activeStartedAt: null,
          updatedAt: sql`now()`,
        })
        .where(sessionGuard),
    ]);
    throw new TutorError(
      message,
      error instanceof TutorError ? error.status : 502,
    );
  }
}

export async function submitQuiz(
  sessionId: string,
  ownerId: string,
  assessmentId: string,
  answers: number[],
) {
  const session = await getTutorSession(sessionId, ownerId);
  if (session.readOnly)
    throw new TutorError("This lesson has changed. Start a current lesson.");
  const guard = and(
    eq(lessonAssessments.id, assessmentId),
    eq(lessonAssessments.sessionId, sessionId),
    eq(lessonAssessments.ownerId, ownerId),
  );
  const [attempt] = await db
    .select()
    .from(lessonAssessments)
    .where(guard)
    .limit(1);
  if (!attempt?.quiz) throw new TutorError("Test not found.", 404);
  if (attempt.status === "failed") throw new TutorError("Start another test.");
  if (attempt.status === "complete")
    return {
      id: attempt.id,
      ...gradeQuiz(attempt.quiz, attempt.answers!),
      review: quizReview(attempt.quiz, attempt.answers!),
    };
  if (answers.length !== attempt.quiz.questions.length)
    throw new TutorError("Answer every question before submitting.", 400);
  const result = gradeQuiz(attempt.quiz, answers);
  const courseGuard = and(
    eq(courses.id, session.courseId),
    eq(courses.ownerId, ownerId),
    eq(courses.status, "ready"),
    eq(courses.sourceVersion, session.sourceVersion),
    eq(courses.outlineVersion, session.sourceVersion),
  );
  const saved = await db.batch([
    db.execute(sql`select id from ${courses} where ${courseGuard} for update`),
    db
      .update(lessonAssessments)
      .set({
        status: "complete",
        answers,
        score: result.score,
        nextStep: result.passed
          ? "Test passed. Continue to the next lesson."
          : "Review the lesson and take the test again.",
      })
      .where(
        and(
          guard,
          eq(lessonAssessments.status, "pending"),
          exists(
            db.select({ id: courses.id }).from(courses).where(courseGuard),
          ),
        ),
      )
      .returning({ id: lessonAssessments.id }),
  ]);
  if (!saved[1].length) {
    const current = await getTutorSession(sessionId, ownerId);
    if (current.readOnly)
      throw new TutorError("The course changed. No result was recorded.");
    const [finished] = await db
      .select()
      .from(lessonAssessments)
      .where(guard)
      .limit(1);
    if (finished?.status === "complete")
      return {
        id: finished.id,
        ...gradeQuiz(finished.quiz!, finished.answers!),
        review: quizReview(finished.quiz!, finished.answers!),
      };
    throw new TutorError("This test changed. Refresh and try again.");
  }
  return {
    id: assessmentId,
    ...result,
    review: quizReview(attempt.quiz, answers),
  };
}
