import { Badge } from "@/components/ui/badge";

export function CourseStatusBadge({
  course,
  progress,
}: {
  course: {
    status: string;
    lessonCount: number;
    outlineVersion: number;
    sourceVersion: number;
  };
  progress: { total: number; completed: number };
}) {
  const completed =
    course.status === "ready" &&
    progress.total > 0 &&
    progress.completed === progress.total;
  const label = completed
    ? "Completed"
    : course.status === "generating"
      ? "Generating"
      : course.status === "failed"
        ? "Needs attention"
        : course.outlineVersion >= 0 &&
            course.outlineVersion !== course.sourceVersion
          ? "Outline out of date"
          : course.status === "ready"
            ? `${course.lessonCount} lessons`
            : "Draft";

  return (
    <Badge
      variant={course.status === "failed" ? "destructive" : "secondary"}
      className={
        completed
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : label === "Draft"
            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
            : undefined
      }
    >
      {label}
    </Badge>
  );
}
