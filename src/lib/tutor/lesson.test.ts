import { describe, expect, it } from "vitest";
import {
  formatQuestionReminder,
  formatTestReady,
  lessonProgress,
  validateLessonPlan,
} from "./lesson";

const plan = {
  chunks: [
    {
      explanation: "Windows + Ctrl + D creates a desktop.",
      question: "Which shortcut creates a desktop?",
    },
    {
      explanation: "Windows + Ctrl + F4 closes a desktop.",
      question: "Which shortcut closes a desktop?",
    },
    {
      explanation: "Windows + Tab shows all desktops.",
      question: "Which shortcut shows all desktops?",
    },
  ],
};

describe("lesson structure", () => {
  it("rejects questions inside explanations and multiple questions in a part", () => {
    for (const change of [
      { explanation: "Ready? Windows + Ctrl + D creates a desktop." },
      { question: "How do you create a desktop? How do you close it?" },
      { question: "Which shortcut closes a desktop?" },
    ])
      expect(() =>
        validateLessonPlan({
          chunks: [{ ...plan.chunks[0], ...change }, ...plan.chunks.slice(1)],
        }),
      ).toThrow();
    expect(validateLessonPlan(plan)).toEqual(plan);
  });
  it("supports old sessions and only exposes Continue between parts", () => {
    expect(lessonProgress(plan, 1)).toEqual({
      total: 3,
      completed: 1,
      ready: false,
      awaitingContinue: false,
    });
    expect(
      lessonProgress({ ...plan, awaitingContinue: true }, 1),
    ).toMatchObject({ awaitingContinue: true, ready: false });
    expect(
      lessonProgress({ ...plan, awaitingContinue: true }, 3),
    ).toMatchObject({ awaitingContinue: false, ready: true });
  });
  it("repeats the saved question exactly and announces the test", () => {
    expect(formatQuestionReminder(plan, 1)).toBe(
      "Question\n\nWhich shortcut closes a desktop?",
    );
    expect(formatTestReady()).toBe(
      "You have finished all lesson parts. You can start the test now.",
    );
  });
});
