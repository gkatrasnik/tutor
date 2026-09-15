import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ process: vi.fn(), protected: vi.fn() }));
vi.mock("@neondatabase/auth/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@neondatabase/auth/server")>()),
  processAuthMiddleware: mocks.process,
}));
vi.mock("@/lib/auth/server", () => ({
  getAuth: () => ({ middleware: () => mocks.protected }),
  getAuthConfig: () => ({
    baseUrl: "https://auth.example.test",
    cookies: { secret: "test-secret", sessionDataTtl: 300 },
  }),
}));
import { proxy, config } from "./proxy";
beforeEach(() => vi.resetAllMocks());
it("refreshes homepage cookies without redirecting anonymous visitors", async () => {
  mocks.process.mockResolvedValue({
    action: "allow",
    cookies: ["session=refreshed; Path=/; HttpOnly"],
  });
  const response = await proxy(new NextRequest("https://example.test/"));
  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("set-cookie")).toContain("session=refreshed");
  expect(response.headers.get("x-middleware-request-cookie")).toContain(
    "session=refreshed",
  );
  expect(mocks.process.mock.calls[0][0].skipRoutes).toEqual(["/"]);
  expect(config.matcher).toContain("/");
});
it.each(["/app", "/admin"])("preserves protection for %s", async (path) => {
  mocks.protected.mockResolvedValue(
    NextResponse.redirect("https://example.test/auth/sign-in"),
  );
  const response = await proxy(new NextRequest(`https://example.test${path}`));
  expect(response.status).toBe(307);
  expect(mocks.process).not.toHaveBeenCalled();
});
it("preserves OAuth redirects and cookies on the public page", async () => {
  mocks.process.mockResolvedValue({
    action: "redirect_oauth",
    redirectUrl: new URL("https://example.test/"),
    cookies: ["session=oauth; Path=/"],
  });
  const response = await proxy(
    new NextRequest("https://example.test/?neon_auth_session_verifier=token"),
  );
  expect(response.status).toBe(307);
  expect(response.headers.get("set-cookie")).toContain("session=oauth");
});
