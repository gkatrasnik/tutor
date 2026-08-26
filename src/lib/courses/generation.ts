import "server-only";

import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import { z } from "zod";

import { env } from "@/lib/env";

import {
  buildCoursePrompt, COURSE_ATTEMPT_TIMEOUT_MS, COURSE_OUTPUT_TOKENS,
  COURSE_SYSTEM_PROMPT, courseOutlineSchema, type CourseSource,
} from "./outline";

export async function generateCourseOutline(source: CourseSource, model: LanguageModel = env.TUTOR_MODEL) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await generateText({
        model,
        reasoning: "none",
        maxOutputTokens: COURSE_OUTPUT_TOKENS,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(COURSE_ATTEMPT_TIMEOUT_MS),
        output: Output.object({ schema: courseOutlineSchema, name: "course_outline" }),
        system: COURSE_SYSTEM_PROMPT,
        prompt: buildCoursePrompt(source, attempt > 0),
      });
      return courseOutlineSchema.parse(result.output);
    } catch (error) {
      const invalidOutput = NoObjectGeneratedError.isInstance(error) || error instanceof z.ZodError;
      if (attempt === 0 && invalidOutput) continue;
      throw error;
    }
  }
  throw new Error("Course generation did not produce an outline.");
}
