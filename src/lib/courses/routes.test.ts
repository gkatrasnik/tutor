import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), process: vi.fn(), ensure: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/materials/processing", () => ({ processMaterial: mocks.process, MaterialProcessingError: class extends Error {} }));
vi.mock("@/lib/courses/service", () => ({ ensureCourseOutline: mocks.ensure, CourseGenerationError: class extends Error {} }));

import { POST as processPost } from "@/app/api/materials/[id]/process/route";
import { POST as coursePost } from "@/app/api/courses/[id]/outline/route";

const materialId = "aca9b80d-e56a-4728-b399-c416806b5069";
const context = { params: Promise.resolve({ id: materialId }) };
const request = new Request("http://localhost/api/materials", { method: "POST" });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "learner-a" });
  mocks.ensure.mockResolvedValue({ id: "course-a", status: "ready" });
});

describe("course generation routes", () => {
  it("indexes material without generating an outline", async () => {
    const result = await processPost(request, context);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true });
    expect(mocks.process).toHaveBeenCalledExactlyOnceWith(materialId, "learner-a");
    expect(mocks.ensure).not.toHaveBeenCalled();
  });

  it("does not generate if indexing fails", async () => {
    mocks.process.mockRejectedValue(new Error("private DB error"));
    const result = await processPost(request, context);
    expect(result.status).toBe(422);
    expect(mocks.ensure).not.toHaveBeenCalled();
    expect(await result.text()).not.toContain("private DB error");
  });

  it("generates explicitly using the authenticated owner", async () => {
    const result = await coursePost(request, context);
    expect(result.status).toBe(200);
    expect(mocks.ensure).toHaveBeenCalledExactlyOnceWith(materialId, "learner-a");
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("returns 202 for an in-flight generation and never re-indexes", async () => {
    mocks.ensure.mockResolvedValue({ id: "course-a", status: "generating" });
    const result = await coursePost(request, context);
    expect(result.status).toBe(202);
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("rejects malformed IDs before database or provider work", async () => {
    const result = await coursePost(request, { params: Promise.resolve({ id: "bad" }) });
    expect(result.status).toBe(400);
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
});
