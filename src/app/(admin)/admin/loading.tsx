import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <main
      className="min-h-screen bg-muted/50"
      aria-busy="true"
      aria-label="Loading administration analytics"
    >
      <div className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between px-5">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-6 w-48" />
        </div>
      </div>
      <div className="mx-auto max-w-[90rem] px-5 py-8 sm:px-8 lg:px-10">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-3 h-9 w-56" />
        <Skeleton className="mt-3 h-5 w-96 max-w-full" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item}>
              <CardHeader>
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="mt-2 h-3 w-40" />
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
      </div>
    </main>
  );
}
