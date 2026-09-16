import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TutorChat } from "./chat";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function render(
  progress: Parameters<typeof TutorChat>[0]["initialLessonProgress"],
  initiallyReadOnly = false,
  initialMessages: Parameters<typeof TutorChat>[0]["initialMessages"] = [],
) {
  return renderToStaticMarkup(
    createElement(TutorChat, {
      sessionId: "session",
      courseId: "course",
      nextLesson: null,
      initialMessages,
      initialSequence: 4,
      initialLessonProgress: progress,
      initiallyReadOnly,
      initiallyActive: false,
      initialAssessments: { items: [], hasMore: false },
      initialCompleted: false,
    }),
  );
}

describe("guided tutor controls", () => {
  it("does not render an empty conversation before the lesson starts", () => {
    const html = render({ total: 0, completed: 0, ready: false });
    expect(html).not.toContain('aria-label="Conversation"');
  });
  it("keeps the transcript in page flow on mobile and bounds it on larger screens", () => {
    const html = render({ total: 3, completed: 1, ready: false }, false, [
      {
        id: "message",
        role: "assistant",
        status: "complete",
        content: "Welcome to the lesson.",
        error: null,
        sourceCount: 0,
      },
    ]);
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Conversation"');
    expect(html).toContain("max-h-none");
    expect(html).toContain("overflow-visible");
    expect(html).toContain("md:max-h-[60vh]");
    expect(html).toContain("md:overflow-y-auto");
  });
  it("offers one input without answer/help controls while a question is active", () => {
    const html = render({ total: 3, completed: 0, ready: false });
    expect(html).toContain("Answer or ask for an explanation…");
    expect(html).toContain(">Send</button>");
    expect(html).not.toContain("Message type");
    expect(html).not.toContain("Ask for help</button>");
    expect(html).not.toContain(">Continue</button>");
  });
  it("restores Continue after feedback and keeps help available", () => {
    const html = render({
      total: 3,
      completed: 1,
      ready: false,
      awaitingContinue: true,
    });
    expect(html).toContain(">Continue</button>");
    expect(html).toContain("Ask about anything you want to understand better…");
    expect(html).toContain("1 of 3 lesson questions answered");
  });
  it("disables Continue in an archived conversation", () => {
    const html = render(
      { total: 3, completed: 1, ready: false, awaitingContinue: true },
      true,
    );
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Continue<\/button>/);
  });
  it("offers review and the test after the final answer, without Continue", () => {
    const html = render({
      total: 3,
      completed: 3,
      ready: true,
      awaitingContinue: false,
    });
    expect(html).toContain("Ready for the test");
    expect(html).toContain("Review the lesson");
    expect(html).not.toContain(">Continue</button>");
  });
});
