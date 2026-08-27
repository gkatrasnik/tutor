export const ADMIN_USAGE_PAGE_SIZE = 25;

export const analyticsRanges = ["7d", "30d", "90d"] as const;
export type AnalyticsRange = (typeof analyticsRanges)[number];

export function parseAnalyticsRange(
  value: string | string[] | undefined,
): AnalyticsRange {
  return analyticsRanges.includes(value as AnalyticsRange)
    ? (value as AnalyticsRange)
    : "30d";
}

export function parsePage(value: string | string[] | undefined) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : 1;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseUserFilter(value: string | string[] | undefined) {
  if (typeof value !== "string") return null;
  const userId = value.trim();
  return userId && userId.length <= 200 ? userId : null;
}

export function analyticsRangeStart(range: AnalyticsRange, now = new Date()) {
  const days = Number.parseInt(range, 10);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
