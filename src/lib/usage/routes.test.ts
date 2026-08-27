import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), limit: vi.fn(), work: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/usage/rate-limit", () => ({ enforceAiRateLimit: mocks.limit }));
vi.mock("@/lib/tutor/service", () => ({ prepareTutorTurn: mocks.work, TutorError: class extends Error {} }));
vi.mock("@/lib/tutor/stream", () => ({ streamTutorTurn: mocks.work }));
vi.mock("@/lib/assessments/service", () => ({ assessLesson: mocks.work, getAssessmentHistory: mocks.work }));
vi.mock("@/lib/materials/processing", () => ({ processMaterial: mocks.work, MaterialProcessingError: class extends Error {} }));
vi.mock("@/lib/courses/service", () => ({ ensureCourseOutline: mocks.work, CourseGenerationError: class extends Error {} }));
vi.mock("next/server", () => ({ after: vi.fn() }));
import { POST as tutor } from "@/app/api/tutor/sessions/[id]/messages/route";
import { POST as assessment, GET as history } from "@/app/api/tutor/sessions/[id]/assessments/route";
import { POST as ingestion } from "@/app/api/materials/[id]/process/route";
import { POST as outline } from "@/app/api/courses/[id]/outline/route";
import { AiLimitError } from "./contracts";
const context = { params: Promise.resolve({ id: crypto.randomUUID() }) };
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "authenticated-owner" }); });

it.each([tutor, assessment, ingestion, outline])("blocks AI routes with a safe 429 before any work", async (route) => {
  mocks.limit.mockRejectedValue(new AiLimitError("Too many AI requests"));
  const request = new Request("http://localhost/api/test", { method: "POST", headers: { "x-user-id": "forged-owner" },
    body: JSON.stringify(route === tutor ? { requestId: crypto.randomUUID(), message: "Hello" } : { requestId: crypto.randomUUID() }) });
  const response = await route(request, context);
  expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("60");
  expect(mocks.limit).toHaveBeenCalledExactlyOnceWith("authenticated-owner", request);
  expect(mocks.work).not.toHaveBeenCalled();
});
it.each([tutor, assessment, ingestion, outline])("authenticates before rate-limit or Gateway work", async (route) => {
  mocks.user.mockRejectedValue(new Error("Sign in"));
  await expect(route(new Request("http://localhost", { method: "POST" }), context)).rejects.toThrow("Sign in");
  expect(mocks.limit).not.toHaveBeenCalled(); expect(mocks.work).not.toHaveBeenCalled();
});
it("does not rate-limit read-only assessment history", async () => {
  mocks.work.mockResolvedValue({ items: [], hasMore: false });
  expect((await history(new Request("http://localhost"), context)).status).toBe(200);
  expect(mocks.limit).not.toHaveBeenCalled();
});
