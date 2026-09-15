import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: mocks.headers,
  cookies: mocks.cookies,
}));
vi.mock("@/lib/auth/env", () => ({
  parseAuthEnv: () => ({
    NEON_AUTH_BASE_URL: "https://auth.example.test",
    NEON_AUTH_COOKIE_SECRET: "test-secret-with-at-least-thirty-two-characters",
  }),
}));

vi.mock("@neondatabase/auth/next/server", () => ({ createNeonAuth: vi.fn() }));

import { getSessionReader } from "./server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(
    new Headers({ cookie: "__Secure-neon-auth.session_token=old-token" }),
  );
  mocks.cookies.mockImplementation(() => {
    throw new Error(
      "Cookies can only be modified in a Server Action or Route Handler.",
    );
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("read-only session checks", () => {
  it("accepts an upstream cookie refresh without touching Next.js cookies during rendering", async () => {
    const data = {
      user: { id: "learner", email: "learner@example.test", name: "Learner" },
      session: {
        id: "session",
        userId: "learner",
        token: "new-token",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    };
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(data), {
          headers: {
            "content-type": "application/json",
            "set-cookie":
              "__Secure-neon-auth.session_token=new-token; Path=/; HttpOnly; Secure",
          },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await getSessionReader().getSession();
    expect(result.data?.user.id).toBe("learner");
    expect(fetch).toHaveBeenCalled();
    expect(mocks.cookies).not.toHaveBeenCalled();
  });
  it("keeps signed-out visitors signed out when an expired cookie is cleared", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("null", {
            headers: {
              "content-type": "application/json",
              "set-cookie":
                "__Secure-neon-auth.session_token=; Max-Age=0; Path=/; Secure",
            },
          }),
      ),
    );
    expect((await getSessionReader().getSession()).data).toBeNull();
    expect(mocks.cookies).not.toHaveBeenCalled();
  });
});
