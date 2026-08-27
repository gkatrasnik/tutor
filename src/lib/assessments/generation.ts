import "server-only";

import { generateText, Output, type LanguageModel } from "ai";
import { env } from "@/lib/env";
import { recordGateway } from "@/lib/usage/gateway";
import type { AiContext } from "@/lib/usage/contracts";
import { ASSESSMENT_OUTPUT_TOKENS, ASSESSMENT_SYSTEM_PROMPT, assessmentResultSchema, buildAssessmentPrompt, type AssessmentEvidence } from "./contracts";

export async function generateAssessment(evidence: AssessmentEvidence, signal: AbortSignal, context: AiContext, model: LanguageModel = env.TUTOR_MODEL) {
  return recordGateway(context, "assessment", typeof model === "string" ? model : model.modelId, async (span) => {
    const result = await generateText({
      model, reasoning: "none", maxOutputTokens: ASSESSMENT_OUTPUT_TOKENS,
      maxRetries: 0, abortSignal: signal,
      onStepEnd: (step) => { span.observe(step); },
      output: Output.object({ schema: assessmentResultSchema, name: "lesson_assessment" }),
      system: ASSESSMENT_SYSTEM_PROMPT, prompt: buildAssessmentPrompt(evidence),
    });
    span.observe(result);
    if (result.finishReason !== "stop") throw new Error("Assessment did not finish.");
    return assessmentResultSchema.parse(result.output);
  });
}
