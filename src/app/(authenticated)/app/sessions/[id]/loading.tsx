import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10"
      aria-busy="true"
      aria-label="Loading your saved conversation"
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-8 h-9 w-72 max-w-full" />
      <Skeleton className="mt-3 h-5 w-full max-w-lg" />
      <Card className="mt-8">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-5">
          <Skeleton className="h-20 w-4/5" />
          <Skeleton className="ml-auto h-16 w-3/4" />
          <Skeleton className="h-24 w-4/5" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    </main>
  );
}
