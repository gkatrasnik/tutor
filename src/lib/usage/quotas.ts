import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiQuotaReservations, tutorDailyUsage } from "@/db/schema";
import { TUTOR_DAILY_LIMIT } from "@/lib/tutor/contracts";
import { AiLimitError, INGESTION_DAILY_LIMIT } from "./contracts";

export async function reserveDailyQuota(
  ownerId: string,
  kind: "tutor" | "ingestion",
) {
  const id = crypto.randomUUID();
  const column = kind === "tutor" ? sql`turns` : sql`ingestions`;
  const limit = kind === "tutor" ? TUTOR_DAILY_LIMIT : INGESTION_DAILY_LIMIT;
  const result = await db.execute(sql`
    with reserved as (
      insert into ${tutorDailyUsage} (owner_id, day, ${column})
      values (${ownerId}, (now() at time zone 'UTC')::date::text, 1)
      on conflict (owner_id, day) do update set ${column} = ${tutorDailyUsage}.${column} + 1
      where ${tutorDailyUsage}.${column} < ${limit} returning day
    )
    insert into ${aiQuotaReservations} (id, owner_id, day, kind)
    select ${id}::uuid, ${ownerId}, day, ${kind}::quota_kind from reserved returning id
  `);
  if (!result.rows.length)
    throw new AiLimitError(
      kind === "tutor"
        ? "You have reached today's 30 tutor turns. Please return after midnight UTC."
        : "You have reached today's 3 material ingestions. Please return after midnight UTC.",
      429,
      Math.ceil(
        (Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate() + 1,
        ) -
          Date.now()) /
          1000,
      ),
    );
  return id;
}

export async function markQuotaStarted(id: string, ownerId: string) {
  const rows = await db
    .update(aiQuotaReservations)
    .set({ state: "started" })
    .where(
      and(
        eq(aiQuotaReservations.id, id),
        eq(aiQuotaReservations.ownerId, ownerId),
        inArray(aiQuotaReservations.state, ["reserved", "started"]),
      ),
    )
    .returning({ id: aiQuotaReservations.id });
  if (!rows.length) throw new Error("Quota reservation is unavailable.");
}

// Idempotent and tied to the original UTC day, including requests spanning midnight.
// A started request is never refunded, even on a provider error or disconnect.
export async function releaseUnusedQuota(id: string, ownerId: string) {
  await db.execute(sql`
    with released as (
      update ${aiQuotaReservations} set state = 'released'
      where id = ${id} and owner_id = ${ownerId} and state = 'reserved' returning day, kind
    )
    update ${tutorDailyUsage} set
      turns = greatest(0, turns - case when released.kind = 'tutor' then 1 else 0 end),
      ingestions = greatest(0, ingestions - case when released.kind = 'ingestion' then 1 else 0 end)
    from released where ${tutorDailyUsage.ownerId} = ${ownerId} and ${tutorDailyUsage.day} = released.day
  `);
}
