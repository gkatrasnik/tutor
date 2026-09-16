import "server-only";

import { generateText, Output, type LanguageModel } from "ai";
import { env } from "@/lib/env";
import {
  OBJECT_OUTPUT_INSTRUCTION,
  recoverWrappedObject,
} from "@/lib/ai/structured-output";
import { recordGateway } from "@/lib/usage/gateway";
import type { AiContext } from "@/lib/usage/contracts";
import {
  ASSESSMENT_OUTPUT_TOKENS,
  ASSESSMENT_SYSTEM_PROMPT,
  quizSchema,
  buildAssessmentPrompt,
  type AssessmentEvidence,
} from "./contracts";

export async function generateAssessment(
  evidence: AssessmentEvidence,
  signal: AbortSignal,
  context: AiContext,
  model: LanguageModel = env.TUTOR_MODEL,
) {
  return recordGateway({
    context,
    feature: "assessment",
    model: typeof model === "string" ? model : model.modelId,
    run: async (recorder) => {
      try {
        const result = await generateText({
          model,
          reasoning: "none",
          maxOutputTokens: ASSESSMENT_OUTPUT_TOKENS,
          maxRetries: 0,
          abortSignal: signal,
          onStepEnd: recorder.recordMetrics,
          output: Output.object({
            schema: quizSchema,
            name: "lesson_assessment",
          }),
          system: `${ASSESSMENT_SYSTEM_PROMPT}\n${OBJECT_OUTPUT_INSTRUCTION}`,
          prompt: buildAssessmentPrompt(evidence),
        });
        recorder.recordMetrics(result);
        if (result.finishReason !== "stop")
          throw new Error("Assessment did not finish.");
        return quizSchema.parse(result.output);
      } catch (error) {
        const recovered = recoverWrappedObject(error, quizSchema);
        if (recovered) {
          recorder.recordMetrics(error);
          return recovered.data;
        }
        throw error;
      }
    },
  });
}
