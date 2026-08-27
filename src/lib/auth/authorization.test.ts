import { describe, expect, it } from "vitest";

import {
  isAdminEmail,
  normalizeEmail,
  parseAdminEmails,
} from "./authorization";

describe("admin authorization", () => {
  it("normalizes email casing and surrounding whitespace", () => {
    expect(normalizeEmail("  Admin@Example.COM ")).toBe("admin@example.com");
  });

  it("parses a comma-separated admin allowlist", () => {
    expect(parseAdminEmails("first@example.com, SECOND@example.com")).toEqual(
      new Set(["first@example.com", "second@example.com"]),
    );
  });

  it("authorizes only exact normalized addresses", () => {
    const admins = "admin@example.com,owner@example.com";

    expect(isAdminEmail("ADMIN@example.com", admins)).toBe(true);
    expect(isAdminEmail("not-admin@example.com", admins)).toBe(false);
  });
});
