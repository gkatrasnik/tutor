import "server-only";

import { generateText, Output, type LanguageModel } from "ai";
import { env } from "@/lib/env";
import { ASSESSMENT_OUTPUT_TOKENS, ASSESSMENT_SYSTEM_PROMPT, assessmentResultSchema, buildAssessmentPrompt, type AssessmentEvidence } from "./contracts";

export async function generateAssessment(evidence: AssessmentEvidence, signal: AbortSignal, model: LanguageModel = env.TUTOR_MODEL) {
  const result = await generateText({
    model, reasoning: "none", maxOutputTokens: ASSESSMENT_OUTPUT_TOKENS,
    maxRetries: 0, abortSignal: signal,
    output: Output.object({ schema: assessmentResultSchema, name: "lesson_assessment" }),
    system: ASSESSMENT_SYSTEM_PROMPT, prompt: buildAssessmentPrompt(evidence),
  });
  if (result.finishReason !== "stop") throw new Error("Assessment did not finish.");
  return assessmentResultSchema.parse(result.output);
}
