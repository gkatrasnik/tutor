import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { logServerError } from "./logger";

describe("logServerError", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("writes stack traces while redacting sensitive context", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("private source text"), {
      code: "provider_rate_limit",
      statusCode: 429,
    });

    logServerError("gateway.failed", error, {
      requestId: "request-1",
      prompt: "learner secret",
      blobUrl: "https://private.example/file",
      accessToken: "secret-token",
    });

    expect(output).toHaveBeenCalledOnce();
    const serialized = String(output.mock.calls[0]?.[0]);
    const entry = JSON.parse(serialized) as Record<string, unknown>;
    expect(entry).toMatchObject({
      level: "error",
      event: "gateway.failed",
      requestId: "request-1",
      prompt: "[REDACTED]",
      blobUrl: "[REDACTED]",
      accessToken: "[REDACTED]",
      error: {
        name: "Error",
        code: "provider_rate_limit",
        status: 429,
      },
    });
    expect(entry.error).toMatchObject({
      stack: expect.stringContaining("private source text"),
    });
    expect(serialized).not.toContain("learner secret");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("private.example");
  });
});
