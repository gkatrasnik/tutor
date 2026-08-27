import {
  Activity,
  Clock3,
  Coins,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  featureLabel,
  formatInteger,
  formatLatency,
  formatTimestamp,
  formatUsd,
} from "@/components/analytics/format";
import { Pagination } from "@/components/analytics/pagination";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  analyticsRanges,
  parseAnalyticsRange,
  parsePage,
  parseUserFilter,
} from "@/lib/analytics/contracts";
import { getAdminAnalytics } from "@/lib/analytics/service";

export const dynamic = "force-dynamic";

const rangeLabels = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
} as const;

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const query = await searchParams;
  const range = parseAnalyticsRange(query.range);
  const requestedPage = parsePage(query.page);
  const userId = parseUserFilter(query.user);
  const analytics = await getAdminAnalytics(range, requestedPage, userId);
  const pageHref = (page: number) => {
    const params = new URLSearchParams({ range, page: String(page) });
    if (userId) params.set("user", userId);
    return `/admin?${params}`;
  };
  if (requestedPage > analytics.pageCount)
    redirect(pageHref(analytics.pageCount));

  const summaryCards = [
    {
      label: "Gateway operations",
      value: formatInteger(analytics.summary.requests),
      icon: Activity,
      detail: `${analytics.summary.errors} failed`,
    },
    {
      label: "Total tokens",
      value: formatInteger(analytics.summary.totalTokens),
      icon: ShieldCheck,
      detail: "Provider-reported totals",
    },
    {
      label: "Average latency",
      value: formatLatency(analytics.summary.averageLatencyMs),
      icon: Clock3,
      detail: "Completed and failed operations",
    },
    {
      label: "Actual known cost",
      value: formatUsd(analytics.summary.costUsd),
      icon: Coins,
      detail: analytics.summary.unknownCosts
        ? `${analytics.summary.unknownCosts} operations have unknown cost`
        : "Every operation reported cost",
    },
  ];

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between px-5">
          <Brand />
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Learner app
            </Link>
            <Badge variant="outline">
              <ShieldCheck aria-hidden="true" /> {analytics.admin.email}
            </Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[90rem] px-5 py-8 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              Read-only administration
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              AI operations
            </h1>
            <p className="mt-2 text-stone-500">
              Locally recorded Gateway usage for product monitoring and cost
              reconciliation.
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-2" action="/admin">
            <label className="grid gap-1 text-xs font-medium text-stone-600">
              Date range
              <select
                name="range"
                defaultValue={range}
                className="h-9 min-w-40 rounded-lg border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {analyticsRanges.map((value) => (
                  <option key={value} value={value}>
                    {rangeLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-stone-600">
              User
              <select
                name="user"
                defaultValue={userId ?? ""}
                className="h-9 min-w-56 rounded-lg border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All users</option>
                {analytics.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
            </label>
            <button className={buttonVariants({ size: "sm" })} type="submit">
              Apply
            </button>
          </form>
        </div>

        <section
          className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Usage summary"
        >
          {summaryCards.map((card) => (
            <Card key={card.label}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm text-stone-500">
                    {card.label}
                  </CardTitle>
                  <card.icon
                    className="size-4 text-emerald-700"
                    aria-hidden="true"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-stone-500">{card.detail}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Tabs defaultValue="overview" className="mt-8">
          <TabsList aria-label="Analytics sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5 space-y-5">
            <div className="grid gap-5 xl:grid-cols-2">
              <BreakdownCard
                title="By feature"
                description="Gateway operations grouped by product feature"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Errors</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.byFeature.map((row) => (
                      <TableRow key={row.feature}>
                        <TableCell>{featureLabel(row.feature)}</TableCell>
                        <NumberCells row={row} />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </BreakdownCard>
              <BreakdownCard
                title="By model"
                description="Use this to reconcile model-level Gateway spend"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Errors</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.byModel.map((row) => (
                      <TableRow key={row.model}>
                        <TableCell
                          className="max-w-64 truncate font-mono text-xs"
                          title={row.model}
                        >
                          {row.model}
                        </TableCell>
                        <NumberCells row={row} />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </BreakdownCard>
            </div>
            <BreakdownCard
              title="By UTC day"
              description={`${rangeLabels[range]}, newest first`}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.byDay.map((row) => (
                    <TableRow key={row.day}>
                      <TableCell>{row.day}</TableCell>
                      <NumberCells row={row} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </BreakdownCard>
          </TabsContent>

          <TabsContent value="users" className="mt-5">
            <BreakdownCard
              title="Highest-usage learners"
              description="Ranked by provider-reported total tokens; maintenance events without an owner are excluded"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.byUser.map((row) => (
                    <TableRow key={row.ownerId}>
                      <TableCell>{row.email ?? row.ownerId}</TableCell>
                      <NumberCells row={row} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </BreakdownCard>
          </TabsContent>

          <TabsContent value="requests" className="mt-5 space-y-5">
            {analytics.failures.length ? (
              <Card className="border-red-200 bg-red-50/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TriangleAlert
                      className="size-4 text-red-700"
                      aria-hidden="true"
                    />
                    Recent failures
                  </CardTitle>
                  <CardDescription>
                    Safe error categories only; prompts and provider responses
                    are never stored.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {analytics.failures.map((failure) => (
                      <li
                        key={failure.id}
                        className="flex flex-col justify-between gap-1 py-3 text-sm sm:flex-row sm:items-center"
                      >
                        <span>
                          {failure.email ?? "Maintenance"} ·{" "}
                          {featureLabel(failure.feature)} ·{" "}
                          <span className="font-mono text-xs">
                            {failure.model}
                          </span>
                        </span>
                        <span className="text-stone-500">
                          {failure.errorCode ?? "unknown failure"} ·{" "}
                          {formatTimestamp(failure.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
            <BreakdownCard
              title="Request history"
              description="Actual Gateway metadata stored by the application"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Reasoning</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                    <TableHead className="text-right">First token</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.requests.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{formatTimestamp(event.createdAt)}</TableCell>
                      <TableCell>{event.email ?? "Maintenance"}</TableCell>
                      <TableCell>{featureLabel(event.feature)}</TableCell>
                      <TableCell
                        className="max-w-56 truncate font-mono text-xs"
                        title={event.model}
                      >
                        {event.model}
                      </TableCell>
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
                      <TableCell className="text-right tabular-nums">
                        {formatUsd(event.costUsd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={analytics.page}
                pageCount={analytics.pageCount}
                href={pageHref}
              />
            </BreakdownCard>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function BreakdownCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function NumberCells({
  row,
}: {
  row: {
    requests: number;
    totalTokens: number;
    errors: number;
    costUsd: string;
  };
}) {
  return (
    <>
      <TableCell className="text-right tabular-nums">
        {formatInteger(row.requests)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatInteger(row.totalTokens)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatInteger(row.errors)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatUsd(row.costUsd)}
      </TableCell>
    </>
  );
}
