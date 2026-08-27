import "server-only";

import {
  generateText,
  NoObjectGeneratedError,
  Output,
  type LanguageModel,
} from "ai";
import { z } from "zod";

import { env } from "@/lib/env";
import { recordGateway } from "@/lib/usage/gateway";
import type { AiContext } from "@/lib/usage/contracts";

import {
  buildCoursePrompt,
  COURSE_ATTEMPT_TIMEOUT_MS,
  COURSE_OUTPUT_TOKENS,
  COURSE_SYSTEM_PROMPT,
  courseOutlineSchema,
  type CourseSource,
} from "./outline";

export async function generateCourseOutline(
  source: CourseSource,
  context: AiContext,
  model: LanguageModel = env.TUTOR_MODEL,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await recordGateway({
        context,
        feature: "outline",
        model: typeof model === "string" ? model : model.modelId,
        run: async (recorder) => {
          const result = await generateText({
            model,
            reasoning: "none",
            maxOutputTokens: COURSE_OUTPUT_TOKENS,
            maxRetries: 0,
            onStepEnd: recorder.recordMetrics,
            abortSignal: AbortSignal.timeout(COURSE_ATTEMPT_TIMEOUT_MS),
            output: Output.object({
              schema: courseOutlineSchema,
              name: "course_outline",
            }),
            system: COURSE_SYSTEM_PROMPT,
            prompt: buildCoursePrompt(source, attempt > 0),
          });
          recorder.recordMetrics(result);
          return courseOutlineSchema.parse(result.output);
        },
      });
    } catch (error) {
      const invalidOutput =
        NoObjectGeneratedError.isInstance(error) || error instanceof z.ZodError;
      if (attempt === 0 && invalidOutput) continue;
      throw error;
    }
  }
  throw new Error("Course generation did not produce an outline.");
}
