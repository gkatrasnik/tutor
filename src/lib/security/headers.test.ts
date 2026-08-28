import { describe, expect, it } from "vitest";

import { securityHeaders } from "./headers";

describe("securityHeaders", () => {
  it("sets browser hardening headers and a restrictive production CSP", () => {
    const headers = new Map(
      securityHeaders(false).map((header) => [header.key, header.value]),
    );
    const csp = headers.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/[\r\n]/);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Strict-Transport-Security")).toContain(
      "max-age=63072000",
    );
  });

  it("allows the development evaluator without sending HSTS", () => {
    const headers = new Map(
      securityHeaders(true).map((header) => [header.key, header.value]),
    );

    expect(headers.get("Content-Security-Policy")).toContain("'unsafe-eval'");
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });
});
