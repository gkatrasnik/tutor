import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import type { getLearnerQuotas } from "@/lib/analytics/service";

export function DailyUsage({
  quotas,
}: {
  quotas: Awaited<ReturnType<typeof getLearnerQuotas>>;
}) {
  return (
    <Accordion className="mt-8 border-t border-border pt-2">
      <AccordionItem value="usage">
        <AccordionTrigger className="items-center gap-3 text-muted-foreground">
          <span className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-medium">Daily usage</span>
            <span className="font-normal">
              {quotas.tutor.remaining} tutor turns left ·{" "}
              {quotas.ingestion.remaining} material imports left
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="pt-3">
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              { label: "Tutor turns", ...quotas.tutor },
              { label: "Material imports", ...quotas.ingestion },
            ].map((quota) => (
              <div key={quota.label} className="space-y-2">
                <p className="flex justify-between gap-3 text-muted-foreground">
                  <span>{quota.label}</span>
                  <span>
                    {quota.used} of {quota.limit} used
                  </span>
                </p>
                <Progress
                  value={quota.limit ? (quota.used / quota.limit) * 100 : 0}
                  aria-label={`${quota.label}: ${quota.used} of ${quota.limit} used`}
                />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Both allowances reset at 00:00 UTC. Adding and preparing a material
            uses a material import.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
