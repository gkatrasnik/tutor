import "server-only";
import { checkRateLimit } from "@vercel/firewall";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { aiRateLimits } from "@/db/schema";
import { logServerError } from "@/lib/observability/logger";
import { AI_REQUESTS_PER_MINUTE, AiLimitError } from "./contracts";

function appHost(request?: Request) {
  const configuredAppHost = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
    : undefined;
  const allowedHosts = new Set(
    [
      configuredAppHost,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
      process.env.VERCEL_URL,
    ].filter((host): host is string => Boolean(host)),
  );
  const requestedHost = request ? new URL(request.url).host : undefined;

  // Prefer the public domain used for this request. Generated deployment URLs
  // can be inaccessible when Vercel Deployment Protection is enabled.
  if (requestedHost && allowedHosts.has(requestedHost)) return requestedHost;
  return (
    configuredAppHost ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL
  );
}

export async function enforceAiRateLimit(ownerId: string, request?: Request) {
  const rule = process.env.VERCEL_FIREWALL_RATE_LIMIT_ID;
  if (rule && process.env.NODE_ENV === "production") {
    let host: string | undefined;
    try {
      host = appHost(request);
      if (!host) throw new Error("No trusted application host is configured.");
      const result = await checkRateLimit(rule, {
        request,
        headers: new Headers({ host }),
        rateLimitKey: ownerId,
      });
      if (result.rateLimited)
        throw new AiLimitError(
          "Too many AI requests. Please wait a minute and retry.",
        );
      if (result.error)
        throw new Error(`Firewall rule unavailable (${result.error}).`);
    } catch (error) {
      if (error instanceof AiLimitError) throw error;
      logServerError("firewall.rate_limit.failed", error, {
        ruleId: rule,
        host,
      });
      throw new AiLimitError(
        "The AI rate-limit service is unavailable. Please retry shortly.",
        503,
      );
    }
  }
  // A bounded timestamp array gives an exact sliding window locally and across
  // server instances. ON CONFLICT locks the user row before evaluating capacity.
  const recent = sql`array(select at from unnest(${aiRateLimits.requests}) as at where at > clock_timestamp() - interval '60 seconds')`;
  const result = await db.execute(sql`
    insert into ${aiRateLimits} (owner_id, requests) values (${ownerId}, array[clock_timestamp()])
    on conflict (owner_id) do update set requests = ${recent} || clock_timestamp()
    where cardinality(${recent}) < ${AI_REQUESTS_PER_MINUTE} returning owner_id
  `);
  if (!result.rows.length)
    throw new AiLimitError(
      "Too many AI requests. Please wait a minute and retry.",
    );
}
