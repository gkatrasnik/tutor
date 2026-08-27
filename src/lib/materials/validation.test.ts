import { describe, expect, it } from "vitest";

import { MAX_PDF_BYTES, materialUploadPrefix } from "./constants";
import {
  createTextSchema,
  normalizeExtractedText,
  validateOwnedPdfBlob,
} from "./validation";

describe("material validation", () => {
  it("accepts a PDF in the signed-in user's private prefix", () => {
    expect(
      validateOwnedPdfBlob("user/1", {
        pathname: `${materialUploadPrefix("user/1")}document.pdf`,
        contentType: "application/pdf",
        size: MAX_PDF_BYTES,
      }),
    ).toBeNull();
  });

  it("rejects a blob owned by another user", () => {
    expect(
      validateOwnedPdfBlob("user-a", {
        pathname: `${materialUploadPrefix("user-b")}document.pdf`,
        contentType: "application/pdf",
        size: 100,
      }),
    ).toMatch(/belong/);
  });

  it("enforces the pasted-text limit", () => {
    expect(
      createTextSchema.safeParse({
        courseId: "02564de2-4a8b-4426-8fe2-4e92cc1265ea",
        title: "Notes",
        text: "x".repeat(100_001),
      }).success,
    ).toBe(false);
  });

  it("requires a valid course association for text material", () => {
    expect(
      createTextSchema.safeParse({ title: "Notes", text: "Some notes" })
        .success,
    ).toBe(false);
    expect(
      createTextSchema.safeParse({
        courseId: "02564de2-4a8b-4426-8fe2-4e92cc1265ea",
        title: "Notes",
        text: "Some notes",
      }).success,
    ).toBe(true);
  });

  it("normalizes extracted PDF text", () => {
    expect(normalizeExtractedText("  First  \n\n\n\nSecond\u0000  ")).toBe(
      "First\n\nSecond",
    );
  });
});
