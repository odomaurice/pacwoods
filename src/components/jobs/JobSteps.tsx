import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

const STEPS = ["Client & materials", "Job details", "Cutlist"] as const;

/** The new-job flow as tabs: who it is for and their boards, then the job, then the cutlist. */
export default function JobSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="New job steps" className="mb-6">
      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((label, i) => {
          const step = i + 1;
          const done = step < current;
          const active = step === current;
          return (
            <li key={label}>
              <span
                aria-current={active ? "step" : undefined}
                className={cn("flex min-h-12 items-center gap-2.5 rounded-lg bg-card px-3", active && "ring-2 ring-brand-gold")}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    active ? "bg-brand-gold text-brand-charcoal" : done ? "bg-brand-charcoal text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" /> : step}
                </span>
                <span className={cn("text-sm", active ? "font-semibold" : "text-muted-foreground")}>{label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
