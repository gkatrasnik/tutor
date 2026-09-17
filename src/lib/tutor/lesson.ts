import { z } from "zod";

export const lessonPlanSchema = z.object({
  chunks: z
    .array(
      z.object({
        explanation: z.string().trim().min(1).max(1600),
        question: z.string().trim().min(1).max(300),
      }),
    )
    .min(3)
    .max(6),
});
export type LessonPlan = z.infer<typeof lessonPlanSchema> & {
  sources?: import("./contracts").TutorSource[];
  // Missing on older sessions, which already displayed the next part.
  awaitingContinue?: boolean;
};

export function validateLessonPlan(value: unknown) {
  const plan = lessonPlanSchema.parse(value);
  const questions = new Set<string>();
  for (const chunk of plan.chunks) {
    const key = chunk.question
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[?？؟]/gu, "")
      .trim();
    if (
      /[?？؟]/u.test(chunk.explanation) ||
      (chunk.question.match(/[?？؟]/gu)?.length ?? 0) > 1 ||
      questions.has(key)
    )
      throw new Error(
        "Lesson must teach first and ask one unique question per part",
      );
    questions.add(key);
  }
  return plan;
}

export function lessonProgress(
  plan: LessonPlan | null,
  completedChunks: number,
) {
  const total = plan?.chunks.length ?? 0;
  return {
    total,
    completed: completedChunks,
    ready: total > 0 && completedChunks === total,
    awaitingContinue: !!plan?.awaitingContinue && completedChunks < total,
  };
}

export function formatLessonChunk(plan: LessonPlan, index: number) {
  const chunk = plan.chunks[index];
  return `Part ${index + 1} of ${plan.chunks.length}\n\n${chunk.explanation}\n\n${chunk.question}`;
}

export function formatQuestionReminder(plan: LessonPlan, index: number) {
  return `Question\n\n${plan.chunks[index].question}`;
}

export function formatTestReady() {
  return "You have finished all lesson parts. You can start the test now.";
}
