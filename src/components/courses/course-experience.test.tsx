import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CourseLibrary } from "./course-library";
import { CourseMaterialsPanel } from "./course-materials-panel";
import { CourseLearningPath } from "./course-learning-path";
import { CourseOutlineStatus } from "./course-outline-status";
import { DailyUsage } from "./daily-usage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/app/(authenticated)/app/materials/material-uploader", () => ({
  MaterialUploader: () => createElement("div", null, "Upload form"),
}));

describe("learning-first course presentation", () => {
  it("opens course creation only for an empty library", () => {
    const empty = renderToStaticMarkup(
      <CourseLibrary count={0}>{null}</CourseLibrary>,
    );
    const returning = renderToStaticMarkup(
      <CourseLibrary count={2}>Saved courses</CourseLibrary>,
    );
    expect(empty).toContain('aria-expanded="true"');
    expect(empty).toContain("Create your first course");
    expect(empty).not.toContain('hidden=""');
    expect(returning).toContain('aria-expanded="false"');
    expect(returning).toContain('hidden=""');
    expect(returning).toContain("Saved courses");
  });

  it("keeps both remaining quotas visible while usage details start collapsed", () => {
    const html = renderToStaticMarkup(
      createElement(DailyUsage, {
        quotas: {
          tutor: { used: 6, limit: 30, remaining: 24 },
          ingestion: { used: 1, limit: 3, remaining: 2 },
        },
      }),
    );
    expect(html).toContain("24 tutor turns left");
    expect(html).toContain("2 material imports left");
    expect(html).toContain('aria-expanded="false"');
  });

  const materialProps = {
    userId: "learner",
    courseId: "course",
    hasOutline: false,
    materialCount: 2,
    issueCount: 0,
    importsRemaining: 2,
    children: "Material rows",
  };
  it("opens uploads for a draft and collapses them after an outline exists", () => {
    const draft = renderToStaticMarkup(
      createElement(CourseMaterialsPanel, materialProps),
    );
    const ready = renderToStaticMarkup(
      createElement(CourseMaterialsPanel, {
        ...materialProps,
        hasOutline: true,
      }),
    );
    expect(draft).toContain('aria-expanded="true"');
    expect(draft).not.toContain('hidden=""');
    expect(ready).toContain('aria-expanded="false"');
    expect(ready).toContain('hidden=""');
    // The form is retained rather than unmounted, preserving draft input on reopen.
    expect(ready).toContain("Upload form");
    expect(ready).toContain("requires an outline update");
    expect(ready).toContain("transition-[height]");
    expect(ready).toContain("motion-reduce:transition-none");
    expect(draft).toContain("Close upload panel");
    expect(ready).toContain("Add material");
    expect(draft).not.toContain("Hide upload panel");
    // Uploads live before, not inside, the independently collapsible file list.
    expect(ready.indexOf("Upload form")).toBeLessThan(
      ready.indexOf('data-slot="accordion-content"'),
    );
  });
  it("surfaces material issues and exhausted imports without a quota card", () => {
    const html = renderToStaticMarkup(
      createElement(CourseMaterialsPanel, {
        ...materialProps,
        hasOutline: true,
        issueCount: 1,
        importsRemaining: 0,
      }),
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("material needs");
    expect(html).toContain("allowance is used up");
  });

  const statusProps = {
    courseId: "course",
    status: "ready" as const,
    hasOutline: true,
    outdated: false,
    canGenerate: true,
    error: null,
  };
  it("renders no success-only outline panel for a healthy course", () => {
    expect(
      renderToStaticMarkup(createElement(CourseOutlineStatus, statusProps)),
    ).toBe("");
  });
  it("offers setup for drafts and a compact update action for outdated outlines", () => {
    const draft = renderToStaticMarkup(
      createElement(CourseOutlineStatus, {
        ...statusProps,
        status: "pending",
        hasOutline: false,
        canGenerate: false,
      }),
    );
    const stale = renderToStaticMarkup(
      createElement(CourseOutlineStatus, { ...statusProps, outdated: true }),
    );
    expect(draft).toContain("Build your learning path");
    expect(draft).toContain("Generate outline");
    expect(draft).toMatch(/<button[^>]*disabled/);
    expect(stale).toContain("Your materials changed");
    expect(stale).toContain("Update outline");
  });
  it("prioritizes generating and failure notices over a stale-outline notice", () => {
    const generating = renderToStaticMarkup(
      createElement(CourseOutlineStatus, {
        ...statusProps,
        status: "generating",
        outdated: true,
      }),
    );
    const failed = renderToStaticMarkup(
      createElement(CourseOutlineStatus, {
        ...statusProps,
        status: "failed",
        error: "Please retry.",
      }),
    );
    expect(generating).toContain("Generating your outline");
    expect(generating).toContain("Check generation");
    expect(failed).toContain("Outline generation needs attention");
    expect(failed).toContain("Retry outline");
    expect(failed).toContain('role="alert"');
  });

  const lessons = [
    {
      id: "first",
      ordinal: 0,
      title: "First lesson",
      objective: "First objective",
      concepts: [],
    },
    {
      id: "second",
      ordinal: 1,
      title: "Second lesson",
      objective: "Second objective",
      concepts: [],
    },
  ];
  it("opens the next incomplete lesson and retains progress and start restrictions", () => {
    const html = renderToStaticMarkup(
      createElement(CourseLearningPath, {
        title: "Learning path",
        lessons,
        completedIds: ["first"],
        disabled: true,
        outdated: true,
        tutorTurnsRemaining: 0,
      }),
    );
    expect(html).toContain("Second objective");
    expect(html).not.toContain("First objective");
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*>Start \/ resume lesson<\/button>/,
    );
    expect(html).toContain("allowance is used up");
  });
  it("offers review of the first lesson when every lesson is complete", () => {
    const html = renderToStaticMarkup(
      createElement(CourseLearningPath, {
        title: "Learning path",
        lessons,
        completedIds: ["first", "second"],
        disabled: false,
        outdated: false,
        tutorTurnsRemaining: 30,
      }),
    );
    expect(html).toContain("All lessons complete");
    expect(html).toContain("First objective");
    expect(html).toContain('aria-valuenow="100"');
  });
});
