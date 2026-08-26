import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), select: vi.fn(), insert: vi.fn(), values: vi.fn(), put: vi.fn(), head: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireUser: mocks.user }));
vi.mock("@vercel/blob", () => ({ put: mocks.put, head: mocks.head }));
vi.mock("@/db", () => ({ db: { select: mocks.select, insert: mocks.insert } }));

import { POST as createCourse } from "@/app/api/courses/route";
import { POST as addMaterial } from "@/app/api/materials/route";
import { createCourseSchema } from "./outline";

const courseId = "02564de2-4a8b-4426-8fe2-4e92cc1265ea";
const otherCourseId = "12564de2-4a8b-4426-8fe2-4e92cc1265ea";
const request = (body: unknown) => new Request("http://localhost/api/courses", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "learner-a" });
  mocks.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ id: courseId }] }) }) });
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockReturnValue({ returning: async () => [{ id: courseId }] });
  mocks.put.mockResolvedValue({ url: "https://example.test/notes", pathname: "materials/learner-a/uploads/notes.txt" });
});

describe("course creation and material association", () => {
  it("creates a named empty draft with the session owner, ignoring a supplied owner", async () => {
    const response = await createCourse(request({ name: "  Biology  ", ownerId: "learner-b" }));
    expect(response.status).toBe(201);
    expect(mocks.values).toHaveBeenCalledExactlyOnceWith({ name: "Biology", ownerId: "learner-a" });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "x".repeat(161)])("rejects an invalid course name", (name) => {
    expect(createCourseSchema.safeParse({ name }).success).toBe(false);
  });

  it("rejects missing course IDs before storage or database writes", async () => {
    const response = await addMaterial(request({ sourceType: "text", title: "Notes", text: "Some notes" }));
    expect(response.status).toBe(400);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects unknown or other-owner courses before any blob access", async () => {
    mocks.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
    for (const sourceType of ["text", "pdf"]) {
      const response = await addMaterial(request({ sourceType, courseId: otherCourseId }));
      expect(response.status).toBe(404);
    }
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.head).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("allows several text materials in the same owned course without creating courses", async () => {
    for (const title of ["Lecture 1", "Lecture 2"]) {
      const response = await addMaterial(request({ sourceType: "text", courseId, title, text: "Study notes" }));
      expect(response.status).toBe(201);
    }
    expect(mocks.values).toHaveBeenCalledTimes(2);
    for (const [value] of mocks.values.mock.calls) expect(value).toMatchObject({ courseId, ownerId: "learner-a", sourceType: "text" });
  });

  it("registers PDFs under their selected course", async () => {
    const pathname = `materials/learner-a/uploads/${courseId}/test.pdf`;
    mocks.head.mockResolvedValue({ pathname, url: "https://example.test/file.pdf", size: 100, contentType: "application/pdf" });
    const response = await addMaterial(request({ courseId, sourceType: "pdf", pathname, url: "https://example.test/file.pdf", originalFilename: "Lecture.pdf" }));
    expect(response.status).toBe(201);
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ courseId, ownerId: "learner-a", sourceType: "pdf" }));
  });

  it("rejects a PDF uploaded to a different course", async () => {
    const pathname = `materials/learner-a/uploads/${otherCourseId}/test.pdf`;
    mocks.head.mockResolvedValue({ pathname, url: "https://example.test/file.pdf", size: 100, contentType: "application/pdf" });
    const response = await addMaterial(request({ courseId, sourceType: "pdf", pathname, url: "https://example.test/file.pdf", originalFilename: "Lecture.pdf" }));
    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
