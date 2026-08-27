import { Activity, Database, MessageCircle } from "lucide-react";
import { redirect } from "next/navigation";

import {
  featureLabel,
  formatInteger,
  formatLatency,
  formatTimestamp,
} from "@/components/analytics/format";
import { Pagination } from "@/components/analytics/pagination";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth/dal";
import { parsePage } from "@/lib/analytics/contracts";
import { getLearnerUsage } from "@/lib/analytics/service";

export const dynamic = "force-dynamic";

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const requestedPage = parsePage(query.page);
  const usage = await getLearnerUsage(user.id, requestedPage);
  if (requestedPage > usage.pageCount)
    redirect(`/app/usage?page=${usage.pageCount}`);

  const quotas = [
    { label: "Tutor turns", icon: MessageCircle, ...usage.quotas.tutor },
    { label: "Material ingestions", icon: Database, ...usage.quotas.ingestion },
  ];

  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10">
      <div>
        <p className="text-sm font-medium text-emerald-700">Usage and limits</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Your AI activity
        </h1>
        <p className="mt-2 max-w-2xl text-stone-500">
          Token and response-time details for your requests. Costs and provider
          model details are visible only to administrators.
        </p>
      </div>

      <section
        className="mt-8 grid gap-4 sm:grid-cols-2"
        aria-label="Daily quota remaining"
      >
        {quotas.map((quota) => (
          <Card key={quota.label}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <quota.icon
                    className="size-4 text-emerald-700"
                    aria-hidden="true"
                  />
                  {quota.label}
                </CardTitle>
                <Badge variant="outline">Resets 00:00 UTC</Badge>
              </div>
              <CardDescription>
                {quota.remaining} remaining today · {quota.used} of{" "}
                {quota.limit} used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress
                value={quota.limit ? (quota.used / quota.limit) * 100 : 0}
                aria-label={`${quota.label}: ${quota.used} of ${quota.limit} used`}
              />
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4 text-emerald-700" aria-hidden="true" />
            Request history
          </CardTitle>
          <CardDescription>
            {usage.total} recorded Gateway{" "}
            {usage.total === 1 ? "operation" : "operations"}. Retrieval and
            generation can create separate rows for one learner action.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usage.events.length ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Reasoning</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                    <TableHead className="text-right">First token</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{formatTimestamp(event.createdAt)}</TableCell>
                      <TableCell>{featureLabel(event.feature)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            event.status === "failure"
                              ? "destructive"
                              : event.status === "pending"
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInteger(event.inputTokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInteger(event.outputTokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInteger(event.reasoningTokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInteger(event.totalTokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatLatency(event.latencyMs)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatLatency(event.timeToFirstTokenMs)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={usage.page}
                pageCount={usage.pageCount}
                href={(page) => `/app/usage?page=${page}`}
              />
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="font-medium">No AI activity yet</p>
              <p className="mt-1 text-sm text-stone-500">
                Process a material, generate an outline, or start a lesson to
                create usage records.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
