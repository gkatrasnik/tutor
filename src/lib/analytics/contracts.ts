export const ADMIN_USAGE_PAGE_SIZE = 25;

export const analyticsRanges = ["7d", "30d", "90d"] as const;
export type AnalyticsRange = (typeof analyticsRanges)[number];

export const requestFeatures = [
  "embedding",
  "outline",
  "tutor",
  "assessment",
] as const;
export type RequestFeature = (typeof requestFeatures)[number];

export const requestStatuses = ["pending", "success", "failure"] as const;
export type RequestStatus = (typeof requestStatuses)[number];

export const requestSorts = [
  "newest",
  "oldest",
  "user_asc",
  "user_desc",
  "feature_asc",
  "model_asc",
  "status_asc",
  "tokens_desc",
  "latency_desc",
  "cost_desc",
] as const;
export type RequestSort = (typeof requestSorts)[number];

export type RequestFilters = {
  user: string;
  model: string;
  feature: RequestFeature | null;
  status: RequestStatus | null;
  sort: RequestSort;
};

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

function parseSearchFilter(value: string | string[] | undefined) {
  if (typeof value !== "string") return null;
  const search = value.trim();
  return search && search.length <= 200 ? search : null;
}

export function parseRequestFilters(query: {
  user?: string | string[];
  model?: string | string[];
  feature?: string | string[];
  status?: string | string[];
  sort?: string | string[];
}): RequestFilters {
  const feature = requestFeatures.includes(query.feature as RequestFeature)
    ? (query.feature as RequestFeature)
    : null;
  const status = requestStatuses.includes(query.status as RequestStatus)
    ? (query.status as RequestStatus)
    : null;
  const sort = requestSorts.includes(query.sort as RequestSort)
    ? (query.sort as RequestSort)
    : "newest";

  return {
    user: parseSearchFilter(query.user) ?? "",
    model: parseSearchFilter(query.model) ?? "",
    feature,
    status,
    sort,
  };
}

export function analyticsRangeStart(range: AnalyticsRange, now = new Date()) {
  const days = Number.parseInt(range, 10);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
