"use client";

import type { Edges } from "@/lib/cutting/types";
import { cn } from "@/lib/utils";

const SIDES: Array<{ key: keyof Edges; label: string; className: string }> = [
  { key: "length1", label: "Top long edge", className: "inset-x-2 top-0 h-2" },
  { key: "length2", label: "Bottom long edge", className: "inset-x-2 bottom-0 h-2" },
  { key: "width1", label: "Left short edge", className: "inset-y-2 left-0 w-2" },
  { key: "width2", label: "Right short edge", className: "inset-y-2 right-0 w-2" },
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
  return (
    <div className="relative h-11 w-16 shrink-0" role="group" aria-label="Edge banding">
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
  );
}
