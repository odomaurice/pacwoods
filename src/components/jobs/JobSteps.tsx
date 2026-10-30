import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

const STEPS = ["Client", "Job details", "Materials", "Cutlist"] as const;

/**
 * The new-job flow as tabs: client, then job details, then materials, then
 * the cutlist. Steps already done are ticked; once the job exists, its later
 * steps can be opened in any order.
 */
export default function JobSteps({ current, workNumber }: { current: 1 | 2 | 3 | 4; workNumber?: string }) {
  const href = (step: number) =>
    workNumber ? (step === 3 ? `/admin/jobs/${workNumber}/materials` : step === 4 ? `/admin/jobs/${workNumber}/cutlist` : undefined) : step === 1 ? "/admin/jobs/new" : undefined;
  return (
    <nav aria-label="New job steps" className="mb-6">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((label, i) => {
          const step = i + 1;
          const done = step < current || (workNumber !== undefined && step <= 2);
          const active = step === current;
          const link = href(step);
          const body = (
            <>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  active ? "bg-brand-gold text-brand-charcoal" : done ? "bg-brand-charcoal text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {done && !active ? <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" /> : step}
              </span>
              <span className={cn("text-sm", active ? "font-semibold" : "text-muted-foreground")}>{label}</span>
            </>
          );
          const cls = cn("flex min-h-12 items-center gap-2.5 rounded-lg px-3", active ? "bg-card ring-2 ring-brand-gold" : "bg-card");
          return (
            <li key={label}>
              {link && !active ? (
                <Link href={link} className={cn(cls, "hover:bg-muted/60")}>
                  {body}
                </Link>
              ) : (
                <span className={cls} aria-current={active ? "step" : undefined}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
