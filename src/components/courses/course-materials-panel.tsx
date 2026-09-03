"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { Plus, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { MaterialUploader } from "@/app/(authenticated)/app/materials/material-uploader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export function CourseMaterialsPanel({
  userId,
  courseId,
  hasOutline,
  materialCount,
  issueCount,
  importsRemaining,
  children,
}: {
  userId: string;
  courseId: string;
  hasOutline: boolean;
  materialCount: number;
  issueCount: number;
  importsRemaining: number;
  children: ReactNode;
}) {
  // Initialize once: a server refresh must not close an upload or discard a draft.
  const [open, setOpen] = useState(!hasOutline || issueCount > 0);
  const [uploadOpen, setUploadOpen] = useState(!hasOutline);
  const [busy, setBusy] = useState(false);
  const uploadId = useId();

  return (
    <section className="mt-8" aria-label="Course materials">
      <Accordion
        value={open ? ["materials"] : []}
        onValueChange={(value) => setOpen(value.includes("materials"))}
      >
        <AccordionItem value="materials">
          <div className="flex flex-wrap items-center gap-3">
            <AccordionTrigger className="min-w-0 flex-1 items-center gap-3">
              <span className="text-base font-semibold">
                Course materials · {materialCount}{" "}
                {materialCount === 1 ? "file" : "files"}
              </span>
            </AccordionTrigger>
            <Button
              variant="outline"
              className="min-w-40"
              aria-expanded={uploadOpen}
              aria-controls={uploadId}
              disabled={busy}
              onClick={() => setUploadOpen((current) => !current)}
            >
              {uploadOpen ? (
                <X aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              {uploadOpen ? "Close upload panel" : "Add material"}
            </Button>
          </div>
          {issueCount > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground" role="status">
              {issueCount}{" "}
              {issueCount === 1 ? "material needs" : "materials need"}{" "}
              preparation or attention. Open the list to check processing or
              retry.
            </p>
          ) : null}
          <Collapsible.Root open={uploadOpen}>
            <Collapsible.Panel
              id={uploadId}
              keepMounted
              className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none"
            >
              <div className="pt-4 pb-1">
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="mb-3 font-semibold">Add course material</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {hasOutline
                      ? "Adding or removing material requires an outline update before you can start or resume lessons. Previous conversations remain available."
                      : "Add PDFs or paste your notes, then generate your learning path below."}
                  </p>
                  {importsRemaining === 0 ? (
                    <p
                      className="mb-4 text-sm text-muted-foreground"
                      role="status"
                    >
                      Today’s material import allowance is used up. You can
                      prepare more material after 00:00 UTC.
                    </p>
                  ) : null}
                  <MaterialUploader
                    userId={userId}
                    courseId={courseId}
                    onBusyChange={setBusy}
                  />
                </div>
              </div>
            </Collapsible.Panel>
          </Collapsible.Root>
          <AccordionContent keepMounted className="pt-4">
            {children}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
