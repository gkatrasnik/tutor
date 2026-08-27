import "server-only";
import { checkRateLimit } from "@vercel/firewall";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { aiRateLimits } from "@/db/schema";
import { AI_REQUESTS_PER_MINUTE, AiLimitError } from "./contracts";

export async function enforceAiRateLimit(ownerId: string, request?: Request) {
  const rule = process.env.VERCEL_FIREWALL_RATE_LIMIT_ID;
  if (rule && process.env.NODE_ENV === "production") {
    try {
      // Never let a client Host header redirect the SDK (which forwards headers)
      // to an arbitrary origin. Only send the configured deployment host.
      const host = process.env.VERCEL_URL ?? new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").host;
      const result = await checkRateLimit(rule, { request, headers: new Headers({ host }), rateLimitKey: ownerId });
      if (result.rateLimited) throw new AiLimitError("Too many AI requests. Please wait a minute and retry.");
      if (result.error) throw new Error("Firewall rule unavailable.");
    } catch (error) {
      if (error instanceof AiLimitError) throw error;
      throw new AiLimitError("The AI rate-limit service is unavailable. Please retry shortly.", 503);
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
  if (!result.rows.length) throw new AiLimitError("Too many AI requests. Please wait a minute and retry.");
}
