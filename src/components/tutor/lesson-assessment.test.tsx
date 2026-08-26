import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LessonAssessment } from "./lesson-assessment";
import type { AssessmentSummary } from "@/lib/assessments/contracts";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const item: AssessmentSummary = { id: "assessment", status: "complete", score: 70, strengths: ["Explains attention"], gaps: ["Needs an example"],
  nextStep: "Apply it to studying", error: null, createdAt: "2026-08-26T10:00:00.000Z" };
function render(overrides: Partial<Parameters<typeof LessonAssessment>[0]> = {}) {
  return renderToStaticMarkup(createElement(LessonAssessment, {
    sessionId: "session", initialHistory: { items: [item], hasMore: false }, initialCompleted: true,
    disabled: false, readOnly: false, active: false, eligible: true, onBusyChange: vi.fn(), onSaved: async () => {}, ...overrides,
  }));
}
describe("assessment presentation", () => {
  it("renders persisted feedback, a score, and completion", () => {
    const html = render();
    for (const text of ["Finish lesson", "Lesson complete", "70/100", "Strengths", "Explains attention", "Knowledge gaps", "Recommended next step", "Apply it to studying"]) expect(html).toContain(text);
    expect(html).toContain('aria-valuenow="70"');
  });
  it("disables finishing for archived sessions without claiming current completion", () => {
    const html = render({ readOnly: true });
    expect(html).toContain("Previous course version");
    expect(html).not.toContain("Lesson complete");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Finish lesson<\/button>/);
  });
  it("shows an honest empty state and disables assessment before enough exchanges", () => {
    const html = render({ initialHistory: { items: [], hasMore: false }, eligible: false, initialCompleted: false });
    expect(html).toContain("No assessments yet");
    expect(html).toContain("First complete at least two exchanges");
    expect(html).not.toContain("Lesson complete");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Finish lesson<\/button>/);
  });
  it("renders failed attempts safely and exposes history pagination", () => {
    const html = render({ initialCompleted: false, initialHistory: { items: [{ ...item, status: "failed", score: null, error: "<script>private()</script>" }], hasMore: true } });
    expect(html).toContain("Failed"); expect(html).toContain("Older assessments");
    expect(html).not.toContain("<script>private()"); expect(html).toContain("&lt;script&gt;");
  });
});
