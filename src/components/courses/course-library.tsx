"use client";

import { Plus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { CreateCourseForm } from "@/components/courses/create-course-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function CourseLibrary({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(count === 0);
  const panelId = useId();

  return (
    <section className="mt-8" aria-labelledby="courses-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2
            id="courses-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Your courses
          </h2>
          <Badge variant="outline">{count}</Badge>
        </div>
        <Button
          variant="outline"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          <Plus aria-hidden="true" />
          {open ? "Close course form" : "Create course"}
        </Button>
      </div>
      <div id={panelId} hidden={!open}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {count ? "Create a course" : "Create your first course"}
            </CardTitle>
            <CardDescription>
              Name your course, then add the material you want to learn.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateCourseForm />
          </CardContent>
        </Card>
      </div>
      {children}
    </section>
  );
}
