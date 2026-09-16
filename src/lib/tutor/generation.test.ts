import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/usage/gateway", () => ({
  recordGateway: async ({
    run,
  }: {
    run: (recorder: { recordMetrics: () => void }) => Promise<unknown>;
  }) => run({ recordMetrics() {} }),
}));

import { generateLessonPlan, generateTutorReply } from "./generation";

const plan = {
  chunks: [
    {
      explanation: "A numerator counts selected parts [1].",
      question: "What does a numerator count?",
    },
    {
      explanation: "A denominator counts equal parts [1].",
      question: "What does a denominator count?",
    },
    {
      explanation: "One half equals two quarters [1].",
      question: "How many quarters equal one half?",
    },
  ],
};
const response = (value: unknown, finish: "stop" | "length" = "stop") => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
  finishReason: { unified: finish, raw: finish },
  warnings: [],
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 10, text: 10, reasoning: 0 },
  },
});
const context = (model: MockLanguageModelV4) => ({
  model,
  signal: AbortSignal.timeout(5000),
  usage: { ownerId: "learner", requestId: "request" },
});

describe("tutor model compatibility", () => {
  it("unwraps both the lesson plan and its review, retaining the independent review", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [response([plan]), response([{ valid: true, issues: "" }])],
    });
    expect(
      await generateLessonPlan(context(model), "Synthetic fractions source"),
    ).toEqual(plan);
    expect(model.doGenerateCalls).toHaveLength(2);
  });
  it("unwraps tutor feedback", async () => {
    const reply = {
      intent: "answer",
      feedback: "Correct, a numerator counts selected parts [1].",
    };
    const model = new MockLanguageModelV4({ doGenerate: response([reply]) });
    expect(
      await generateTutorReply(context(model), "Synthetic answer"),
    ).toEqual(reply);
    expect(model.doGenerateCalls).toHaveLength(1);
  });
  it("does not publish an invalid wrapped lesson", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: response([{ chunks: [] }]),
    });
    await expect(
      generateLessonPlan(context(model), "source"),
    ).rejects.toThrow();
  });
  it("rejects a truncated response even when its wrapped JSON parses", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: response([plan], "length"),
    });
    await expect(
      generateLessonPlan(context(model), "source"),
    ).rejects.toThrow();
  });
});
