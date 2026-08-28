import "server-only";

type LogValue = string | number | boolean | null | undefined;
type LogContext = Record<string, LogValue>;

const sensitiveKey =
  /authorization|cookie|password|secret|token|prompt|content|text|blob|url|email/i;

function safeContext(context: LogContext) {
  return Object.fromEntries(
    Object.entries(context)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        sensitiveKey.test(key)
          ? "[REDACTED]"
          : typeof value === "string"
            ? value.slice(0, 200)
            : value,
      ]),
  );
}

function safeError(error: unknown) {
  if (!(error instanceof Error)) return { name: "UnknownError" };
  const candidate = error as Error & {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    type?: unknown;
  };
  return {
    name: error.name || "Error",
    stack:
      typeof error.stack === "string"
        ? error.stack.slice(0, 10_000)
        : undefined,
    code:
      typeof candidate.code === "string"
        ? candidate.code.slice(0, 100)
        : undefined,
    type:
      typeof candidate.type === "string"
        ? candidate.type.slice(0, 100)
        : undefined,
    status:
      typeof candidate.status === "number"
        ? candidate.status
        : typeof candidate.statusCode === "number"
          ? candidate.statusCode
          : undefined,
  };
}

export function logServerError(
  event: string,
  error: unknown,
  context: LogContext = {},
) {
  console.error(
    JSON.stringify({
      level: "error",
      event: /^[a-z0-9._-]{1,100}$/.test(event) ? event : "server.error",
      timestamp: new Date().toISOString(),
      ...safeContext(context),
      error: safeError(error),
    }),
  );
}
