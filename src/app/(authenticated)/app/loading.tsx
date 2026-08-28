import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <main
      className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10"
      aria-busy="true"
      aria-label="Loading courses"
    >
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-3 h-9 w-72 max-w-full" />
      <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[0, 1].map((item) => (
          <Card key={item}>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-56 max-w-full" />
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
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <Card key={item}>
            <CardHeader>
              <Skeleton className="size-11 rounded-2xl" />
              <Skeleton className="mt-4 h-6 w-48" />
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
