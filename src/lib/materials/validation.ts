import { z } from "zod";

import { MAX_PDF_BYTES, MAX_TEXT_CHARACTERS, materialUploadPrefix } from "./constants";

export const registerPdfSchema = z.object({
  courseId: z.uuid(),
  url: z.url(),
  pathname: z.string().min(1),
  originalFilename: z.string().trim().min(1).max(255),
});

export const createTextSchema = z.object({
  courseId: z.uuid(),
  title: z.string().trim().min(1, "Give your notes a title.").max(255),
  text: z.string().trim().min(1, "Paste some text first.").max(
    MAX_TEXT_CHARACTERS,
    `Pasted text cannot exceed ${MAX_TEXT_CHARACTERS.toLocaleString()} characters.`,
  ),
});

export function validateOwnedPdfBlob(
  userId: string,
  blob: { pathname: string; contentType: string; size: number },
) {
  if (!blob.pathname.startsWith(materialUploadPrefix(userId))) {
    return "This upload does not belong to your account.";
  }
  if (blob.contentType !== "application/pdf") {
    return "Only PDF files are supported.";
  }
  if (blob.size <= 0 || blob.size > MAX_PDF_BYTES) {
    return "PDF files must be no larger than 5 MB.";
  }
  return null;
}

export function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
