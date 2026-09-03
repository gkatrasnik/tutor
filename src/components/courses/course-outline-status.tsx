import { CourseAction } from "@/components/courses/course-action";

export function CourseOutlineStatus({
  courseId,
  status,
  hasOutline,
  outdated,
  canGenerate,
  error,
}: {
  courseId: string;
  status: "pending" | "generating" | "ready" | "failed";
  hasOutline: boolean;
  outdated: boolean;
  canGenerate: boolean;
  error: string | null;
}) {
  if (hasOutline && status === "ready" && !outdated) return null;

  const title =
    status === "generating"
      ? "Generating your outline"
      : status === "failed"
        ? "Outline generation needs attention"
        : outdated
          ? "Your materials changed"
          : "Build your learning path";
  return (
    <section
      className="mt-6 rounded-xl border border-border bg-card p-5"
      aria-label="Outline status"
    >
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {status === "generating"
          ? "Your outline is being prepared. Check again shortly; interrupted attempts can be retried after five minutes."
          : outdated
            ? "Update the outline to include your current materials before starting or resuming lessons. Your previous lessons remain below until the update succeeds."
            : hasOutline
              ? "Retry the update when you are ready. Your previous lessons and conversations are still available below."
              : canGenerate
                ? "Your materials are ready. Turn them into a focused path of 4–8 lessons."
                : "Add and prepare at least one material before generating your outline."}
      </p>
      {!canGenerate && hasOutline ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Prepare all attached materials before updating. Check the material
          list below for processing or errors.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-3">
        <CourseAction
          courseId={courseId}
          status={status}
          outdated={outdated}
          disabled={!canGenerate}
        />
      </div>
    </section>
  );
}
