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
import { AccountMenu } from "@/components/account-menu";
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
import { Input } from "@/components/ui/input";
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
  parseRequestFilters,
  requestFeatures,
  requestStatuses,
  requestSorts,
  type RequestFilters,
} from "@/lib/analytics/contracts";
import { getAdminAnalytics } from "@/lib/analytics/service";

export const dynamic = "force-dynamic";

const rangeLabels = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
} as const;

const requestSortLabels = {
  newest: "Newest first",
  oldest: "Oldest first",
  user_asc: "User A–Z",
  user_desc: "User Z–A",
  feature_asc: "Feature A–Z",
  model_asc: "Model A–Z",
  status_asc: "Status A–Z",
  tokens_desc: "Most tokens",
  latency_desc: "Highest latency",
  cost_desc: "Highest cost",
} as const;

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const query = await searchParams;
  const range = parseAnalyticsRange(query.range);
  const requestedPage = parsePage(query.page);
  const requestFilters = parseRequestFilters(query);
  const activeTab =
    query.tab === "requests"
      ? "requests"
      : query.tab === "users"
        ? "users"
        : "overview";
  const analytics = await getAdminAnalytics(
    range,
    requestedPage,
    requestFilters,
  );
  const adminName = analytics.admin.name?.trim() || analytics.admin.email;
  const adminInitials = adminName
    .split(/\s+|@/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const pageHref = (page: number) => {
    const params = requestFilterParams(range, requestFilters);
    params.set("page", String(page));
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
      iconTone: "bg-play-blue text-white",
    },
    {
      label: "Total tokens",
      value: formatInteger(analytics.summary.totalTokens),
      icon: ShieldCheck,
      detail: "Provider-reported totals",
      iconTone: "bg-primary text-primary-foreground",
    },
    {
      label: "Average latency",
      value: formatLatency(analytics.summary.averageLatencyMs),
      icon: Clock3,
      detail: "Completed and failed operations",
      iconTone: "bg-play-orange text-white",
    },
    {
      label: "Actual known cost",
      value: formatUsd(analytics.summary.costUsd),
      icon: Coins,
      detail: analytics.summary.unknownCosts
        ? `${analytics.summary.unknownCosts} operations have unknown cost`
        : "Every operation reported cost",
      iconTone: "bg-play-yellow text-play-yellow-foreground",
    },
  ];

  return (
    <main className="min-h-screen bg-muted/50">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between px-5">
          <Brand />
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Learner app
            </Link>
            <AccountMenu
              displayName={adminName}
              email={analytics.admin.email}
              initials={adminInitials}
              showAdmin
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[90rem] px-5 py-8 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-primary">
              Read-only administration
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              AI operations
            </h1>
            <p className="mt-2 text-muted-foreground">
              Locally recorded Gateway usage for product monitoring and cost
              reconciliation.
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-2" action="/admin">
            {activeTab !== "overview" ? (
              <input type="hidden" name="tab" value={activeTab} />
            ) : null}
            {activeTab === "requests" ? (
              <RequestFilterFields filters={requestFilters} />
            ) : null}
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Date range
              <select
                name="range"
                defaultValue={range}
                className="h-9 min-w-40 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {analyticsRanges.map((value) => (
                  <option key={value} value={value}>
                    {rangeLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <button className={buttonVariants({ size: "lg" })} type="submit">
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
                  <CardTitle className="text-sm text-muted-foreground">
                    {card.label}
                  </CardTitle>
                  <span
                    className={`flex size-8 items-center justify-center rounded-[0.6rem] ${card.iconTone}`}
                  >
                    <card.icon className="size-4" aria-hidden="true" />
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.detail}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Tabs defaultValue={activeTab} className="mt-8">
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
              <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TriangleAlert
                      className="size-4 text-destructive"
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
                        <span className="text-muted-foreground">
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
              description={`${formatInteger(analytics.requestTotal)} matching Gateway ${analytics.requestTotal === 1 ? "operation" : "operations"}`}
            >
              <form
                action="/admin"
                className="mb-5 grid gap-3 rounded-xl border border-border bg-muted/50 p-4 md:grid-cols-2 xl:grid-cols-5"
              >
                <input type="hidden" name="range" value={range} />
                <input type="hidden" name="tab" value="requests" />
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  User email
                  <Input
                    key={`user-${requestFilters.user}`}
                    type="search"
                    name="user"
                    defaultValue={requestFilters.user}
                    placeholder="name@example.com"
                    maxLength={200}
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Model
                  <Input
                    key={`model-${requestFilters.model}`}
                    type="search"
                    name="model"
                    defaultValue={requestFilters.model}
                    placeholder="Model contains…"
                    maxLength={200}
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Feature
                  <select
                    name="feature"
                    defaultValue={requestFilters.feature ?? ""}
                    className={selectClassName}
                  >
                    <option value="">All features</option>
                    {requestFeatures.map((feature) => (
                      <option key={feature} value={feature}>
                        {featureLabel(feature)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Status
                  <select
                    name="status"
                    defaultValue={requestFilters.status ?? ""}
                    className={selectClassName}
                  >
                    <option value="">All statuses</option>
                    {requestStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Sort by
                  <select
                    name="sort"
                    defaultValue={requestFilters.sort}
                    className={selectClassName}
                  >
                    {requestSorts.map((sort) => (
                      <option key={sort} value={sort}>
                        {requestSortLabels[sort]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-2 md:col-span-2 xl:col-span-5">
                  <button
                    type="submit"
                    className={buttonVariants({ size: "lg" })}
                  >
                    Apply filters
                  </button>
                  <Link
                    href={`/admin?range=${range}&tab=requests`}
                    className={buttonVariants({ variant: "ghost", size: "lg" })}
                  >
                    Clear
                  </Link>
                </div>
              </form>
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
                  {analytics.requests.length ? (
                    analytics.requests.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          {formatTimestamp(event.createdAt)}
                        </TableCell>
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
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={12}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No requests match these filters.
                      </TableCell>
                    </TableRow>
                  )}
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

function RequestFilterFields({ filters }: { filters: RequestFilters }) {
  return (
    <>
      <input type="hidden" name="user" value={filters.user} />
      <input type="hidden" name="model" value={filters.model} />
      <input type="hidden" name="feature" value={filters.feature ?? ""} />
      <input type="hidden" name="status" value={filters.status ?? ""} />
      <input type="hidden" name="sort" value={filters.sort} />
    </>
  );
}

function requestFilterParams(range: string, filters: RequestFilters) {
  const params = new URLSearchParams({ range, tab: "requests" });
  if (filters.user) params.set("user", filters.user);
  if (filters.model) params.set("model", filters.model);
  if (filters.feature) params.set("feature", filters.feature);
  if (filters.status) params.set("status", filters.status);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  return params;
}
