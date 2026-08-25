export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_PAGES = 50;
export const MAX_TEXT_CHARACTERS = 100_000;

export function materialUploadPrefix(userId: string) {
  return `materials/${encodeURIComponent(userId)}/uploads/`;
}
