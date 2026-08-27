import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  assess: vi.fn(),
  history: vi.fn(),
}));
vi.mock("@/lib/usage/rate-limit", () => ({ enforceAiRateLimit: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/assessments/service", () => ({
  assessLesson: mocks.assess,
  getAssessmentHistory: mocks.history,
}));
vi.mock("@/lib/tutor/service", () => ({
  TutorError: class extends Error {
    constructor(
      message: string,
      public status = 409,
    ) {
      super(message);
    }
  },
}));

import { GET, POST } from "@/app/api/tutor/sessions/[id]/assessments/route";
import { TutorError } from "@/lib/tutor/service";
const sessionId = "02564de2-4a8b-4426-8fe2-4e92cc1265ea";
const context = { params: Promise.resolve({ id: sessionId }) };
function request(body: unknown) {
  return new Request("http://localhost/api/assessments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "owner" });
});
describe("assessment route boundaries", () => {
  it("accepts only a request ID and obtains the owner from authentication", async () => {
    const requestId = crypto.randomUUID();
    mocks.assess.mockResolvedValue({ id: "assessment" });
    expect((await POST(request({ requestId }), context)).status).toBe(200);
    expect(mocks.assess).toHaveBeenCalledExactlyOnceWith(
      sessionId,
      "owner",
      requestId,
    );
  });
  it("rejects forged scores, history, ownership, malformed JSON, and oversized input before work", async () => {
    for (const extra of [
      { score: 100 },
      { messages: [] },
      { ownerId: "attacker" },
      { sources: [] },
    ]) {
      expect(
        (
          await POST(
            request({ requestId: crypto.randomUUID(), ...extra }),
            context,
          )
        ).status,
      ).toBe(400);
    }
    expect((await POST(request({}), context)).status).toBe(400);
    expect(
      (await POST(request({ data: "x".repeat(1001) }), context)).status,
    ).toBe(413);
    expect(
      (
        await POST(
          new Request("http://localhost", { method: "POST", body: "bad JSON" }),
          context,
        )
      ).status,
    ).toBe(400);
    expect(mocks.assess).not.toHaveBeenCalled();
  });
  it("authorizes history and validates pagination and session IDs", async () => {
    mocks.history.mockResolvedValue({ items: [], hasMore: false });
    const response = await GET(
      new Request("http://localhost?offset=20"),
      context,
    );
    expect(mocks.history).toHaveBeenCalledExactlyOnceWith(
      sessionId,
      "owner",
      20,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    for (const offset of ["-1", "1.5", "no", "1000001"])
      expect(
        (await GET(new Request(`http://localhost?offset=${offset}`), context))
          .status,
      ).toBe(400);
    expect(
      (
        await POST(request({ requestId: crypto.randomUUID() }), {
          params: Promise.resolve({ id: "bad" }),
        })
      ).status,
    ).toBe(400);
  });
  it("redacts unknown failures but preserves safe ownership and conflict errors", async () => {
    mocks.assess.mockRejectedValueOnce(new Error("private query details"));
    const response = await POST(
      request({ requestId: crypto.randomUUID() }),
      context,
    );
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private");
    mocks.assess.mockRejectedValueOnce(
      new TutorError("Session not found.", 404),
    );
    expect(
      (await POST(request({ requestId: crypto.randomUUID() }), context)).status,
    ).toBe(404);
    mocks.history.mockRejectedValueOnce(
      new TutorError("Session not found.", 404),
    );
    expect((await GET(new Request("http://localhost"), context)).status).toBe(
      404,
    );
  });
  it("does no work when authentication fails", async () => {
    mocks.user.mockRejectedValue(new Error("Sign in"));
    await expect(
      POST(request({ requestId: crypto.randomUUID() }), context),
    ).rejects.toThrow("Sign in");
    await expect(GET(new Request("http://localhost"), context)).rejects.toThrow(
      "Sign in",
    );
    expect(mocks.assess).not.toHaveBeenCalled();
    expect(mocks.history).not.toHaveBeenCalled();
  });
});
