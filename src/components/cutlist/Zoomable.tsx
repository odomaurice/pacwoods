"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

const LEVELS = [1, 1.5, 2, 3];

/** Lets large layouts be enlarged and scrolled; the drawing itself scales. */
export default function Zoomable({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState(0);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 print:hidden">
        <Button size="sm" variant="outline" disabled={level === 0} onClick={() => setLevel((l) => l - 1)} aria-label="Zoom out">
          −
        </Button>
        <span className="w-12 text-center text-sm tabular-nums">{Math.round(LEVELS[level] * 100)}%</span>
        <Button size="sm" variant="outline" disabled={level === LEVELS.length - 1} onClick={() => setLevel((l) => l + 1)} aria-label="Zoom in">
          +
        </Button>
      </div>
      <div className="overflow-auto">
        <div style={{ width: `${LEVELS[level] * 100}%` }}>{children}</div>
      </div>
    </div>
  );
}
