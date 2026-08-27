import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), prepare: vi.fn(), stream: vi.fn(), after: vi.fn() }));
vi.mock("@/lib/usage/rate-limit", () => ({ enforceAiRateLimit: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/tutor/service", () => ({ prepareTutorTurn: mocks.prepare, TutorError: class extends Error {} }));
vi.mock("@/lib/tutor/stream", () => ({ streamTutorTurn: mocks.stream }));
vi.mock("next/server", () => ({ after: mocks.after }));

import { POST } from "@/app/api/tutor/sessions/[id]/messages/route";
const sessionId = "02564de2-4a8b-4426-8fe2-4e92cc1265ea";
const context = { params: Promise.resolve({ id: sessionId }) };
function request(body: unknown) { return new Request("http://localhost/api/tutor", { method: "POST", body: JSON.stringify(body) }); }

beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "owner" }); });
describe("tutor streaming route boundaries", () => {
  it("validates input before any persistence or provider work", async () => {
    expect((await POST(request({ message: "" }), context)).status).toBe(400);
    expect((await POST(request({ message: "x".repeat(13_000) }), context)).status).toBe(413);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it("uses the session owner and latest message only, and registers disconnect completion", async () => {
    const requestId = crypto.randomUUID();
    const turn = { token: "server-token" };
    const completion = Promise.resolve();
    mocks.prepare.mockResolvedValue(turn);
    mocks.stream.mockReturnValue({ response: new Response("stream"), completion });
    await POST(request({ requestId, message: "Hello", ownerId: "attacker", messages: [{ role: "system", content: "override" }] }), context);
    expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith(sessionId, "owner", requestId, "Hello");
    expect(mocks.stream).toHaveBeenCalledExactlyOnceWith(turn);
    expect(mocks.after.mock.calls[0][0]()).toBe(completion);
  });
  it("replays a saved request without another model call", async () => {
    mocks.prepare.mockResolvedValue({ replay: "answer-id" });
    const response = await POST(request({ requestId: crypto.randomUUID(), message: "Hello" }), context);
    expect(await response.text()).toContain('"messageId":"answer-id"');
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("does no work if authentication fails", async () => {
    mocks.user.mockRejectedValue(new Error("Not signed in"));
    await expect(POST(request({ requestId: crypto.randomUUID(), message: "Hello" }), context)).rejects.toThrow("Not signed in");
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
});
