import { sql } from "drizzle-orm";

import { db } from "@/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type HealthRow = {
  databaseName: string;
  serverVersion: string;
  vectorEnabled: boolean;
};

export async function GET() {
  if (env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  const startedAt = performance.now();

  try {
    const queryResult = await db.execute<HealthRow>(sql`
      select
        current_database() as "databaseName",
        current_setting('server_version') as "serverVersion",
        exists(
          select 1
          from pg_extension
          where extname = 'vector'
        ) as "vectorEnabled"
    `);
    const result = queryResult.rows[0];

    return Response.json({
      status: "ok",
      database: result.databaseName,
      postgresVersion: result.serverVersion,
      vectorEnabled: result.vectorEnabled,
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch {
    return Response.json(
      {
        status: "error",
        message: "Database health check failed",
      },
      { status: 503 },
    );
  }
}
