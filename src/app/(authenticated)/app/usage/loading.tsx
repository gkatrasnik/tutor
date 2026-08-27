import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function UsageLoading() {
  return (
    <main
      className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10"
      aria-busy="true"
      aria-label="Loading usage"
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-9 w-72" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[0, 1].map((item) => (
          <Card key={item}>
            <CardHeader>
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-52" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-8">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
