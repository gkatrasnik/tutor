import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CourseLoading() {
  return (
    <main
      className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10"
      aria-busy="true"
      aria-label="Loading your course"
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-8 h-4 w-28" />
      <Skeleton className="mt-3 h-9 w-72 max-w-full" />
      <Skeleton className="mt-3 h-5 w-full max-w-lg" />
      {[0, 1, 2].map((item) => (
        <Card key={item} className="mt-8">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
