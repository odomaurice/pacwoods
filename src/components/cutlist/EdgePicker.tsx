"use client";

import type { Edges } from "@/lib/cutting/types";
import { cn } from "@/lib/utils";

const SIDES: Array<{ key: keyof Edges; label: string; className: string }> = [
  { key: "length1", label: "Top long edge", className: "inset-x-2 top-0 h-2" },
  {
    key: "length2",
    label: "Bottom long edge",
    className: "inset-x-2 bottom-0 h-2",
  },
  {
    key: "width1",
    label: "Left short edge",
    className: "inset-y-2 left-0 w-2",
  },
  {
    key: "width2",
    label: "Right short edge",
    className: "inset-y-2 right-0 w-2",
  },
];

/**
 * A panel drawn as a rectangle; tap a side to band it. Long sides are top and
 * bottom, as the panel appears on the cutting plan.
 */
export default function EdgePicker({
  value,
  onChange,
  disabled,
}: {
  value: Edges;
  onChange: (edges: Edges) => void;
  disabled?: boolean;
}) {
  const all = value.length1 && value.length2 && value.width1 && value.width2;
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="relative h-11 w-16 shrink-0"
        role="group"
        aria-label="Edge banding"
      >
        <div className="absolute inset-2 rounded-[2px] bg-muted" aria-hidden />
        {SIDES.map((side) => {
          const on = value[side.key];
          return (
            <button
              key={side.key}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              aria-label={side.label}
              title={side.label}
              onClick={() => onChange({ ...value, [side.key]: !on })}
              className={cn(
                "absolute rounded-full transition-colors disabled:cursor-not-allowed",
                side.className,
                on ? "bg-brand-gold" : "bg-border hover:bg-brand-slate/40",
              )}
            />
          );
        })}
      </div>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={all}
        title={all ? "Remove banding from all sides" : "Band all four sides"}
        onClick={() =>
          onChange({ length1: !all, length2: !all, width1: !all, width2: !all })
        }
        className={cn(
          "h-8 cursor-pointer rounded-full px-2.5 text-xs font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50",
          all
            ? "bg-brand-gold text-brand-charcoal"
            : "bg-muted text-muted-foreground hover:bg-muted/70",
        )}
      >
        All round
      </button>
    </div>
  );
}
