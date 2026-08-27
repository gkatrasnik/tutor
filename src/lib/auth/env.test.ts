import { describe, expect, it } from "vitest";

import { parseAuthEnv } from "./env";

describe("Neon Auth environment validation", () => {
  it("accepts a valid auth endpoint and cookie secret", () => {
    expect(
      parseAuthEnv({
        NEON_AUTH_BASE_URL:
          "https://example.neonauth.example.com/database/auth",
        NEON_AUTH_COOKIE_SECRET: "a-secure-cookie-secret-with-32-characters",
      }),
    ).toEqual({
      NEON_AUTH_BASE_URL: "https://example.neonauth.example.com/database/auth",
      NEON_AUTH_COOKIE_SECRET: "a-secure-cookie-secret-with-32-characters",
    });
  });

  it("rejects cookie secrets shorter than 32 characters", () => {
    expect(() =>
      parseAuthEnv({
        NEON_AUTH_BASE_URL:
          "https://example.neonauth.example.com/database/auth",
        NEON_AUTH_COOKIE_SECRET: "too-short",
      }),
    ).toThrow("NEON_AUTH_COOKIE_SECRET");
  });
});
