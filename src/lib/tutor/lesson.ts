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
};

export function lessonProgress(
  plan: LessonPlan | null,
  completedChunks: number,
) {
  const total = plan?.chunks.length ?? 0;
  return {
    total,
    completed: completedChunks,
    ready: total > 0 && completedChunks === total,
  };
}

export function formatLessonChunk(plan: LessonPlan, index: number) {
  const chunk = plan.chunks[index];
  return `Part ${index + 1} of ${plan.chunks.length}\n\n${chunk.explanation}\n\n${chunk.question}`;
}
