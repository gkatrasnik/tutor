const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

export function formatInteger(value: number | null) {
  return value === null ? "—" : integer.format(value);
}

export function formatLatency(value: number | null) {
  return value === null ? "—" : `${integer.format(value)} ms`;
}

export function formatUsd(value: string | null) {
  return value === null ? "Unknown" : usd.format(Number(value));
}

export function formatTimestamp(value: Date) {
  return (
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(value) + " UTC"
  );
}

export function featureLabel(
  feature: "embedding" | "outline" | "tutor" | "assessment",
) {
  return feature === "embedding"
    ? "Embedding"
    : feature === "outline"
      ? "Course outline"
      : feature === "tutor"
        ? "Tutor"
        : "Assessment";
}
