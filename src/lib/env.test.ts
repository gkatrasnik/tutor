import { describe, expect, it } from "vitest";

import { parseEnv } from "./env-schema";

describe("environment validation", () => {
  it("uses the fixed model defaults", () => {
    const result = parseEnv({ DATABASE_URL: "postgresql://user:password@example.com/tutor" });

    expect(result.TUTOR_MODEL).toBe("alibaba/qwen3.7-flash");
    expect(result.EMBEDDING_MODEL).toBe("openai/text-embedding-3-small");
    expect(result.EMBEDDING_DIMENSION).toBe(1536);
  });

  it("rejects an invalid application URL", () => {
    expect(() => parseEnv({
      DATABASE_URL: "postgresql://user:password@example.com/tutor",
      NEXT_PUBLIC_APP_URL: "not-a-url",
    })).toThrow(
      "Invalid environment configuration",
    );
  });

  it("requires a database connection string", () => {
    expect(() => parseEnv({})).toThrow("DATABASE_URL");
  });

  it("rejects an embedding dimension that does not match the database schema", () => {
    expect(() => parseEnv({
      DATABASE_URL: "postgresql://user:password@example.com/tutor",
      EMBEDDING_DIMENSION: "512",
    })).toThrow("must remain 1536");
  });
});
