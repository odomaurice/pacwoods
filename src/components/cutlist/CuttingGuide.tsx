"use client";

import { useMemo, useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { markCutAction } from "@/actions/production";
import GuideDrawing from "@/components/cutlist/GuideDrawing";
import { Collapsible } from "@/components/cutlist/PlanViewer";
import { Button } from "@/components/ui/button";
import { cuttingSteps, type GuideResult, type GuideStep } from "@/lib/cutting/guide";
import type { PlanSheet } from "@/lib/cutting/types";
import { cn } from "@/lib/utils";

export type GuidePart = {
  ref: string;
  /** 1-based row number in the cutlist; panel codes are "<no>.<copy>". */
  no: number;
  label: string;
  fill: string;
  quantity: number;
  edges: string;
  grain: boolean;
};

/**
 * Step-by-step cutting instructions for each board, one saw cut at a time,
 * in workshop order. The operator working the job can tick cuts off; it is a
 * guide, so nothing here blocks completing the stage.
 */
export default function CuttingGuide({
  sheets,
  parts,
  stockLabels,
  kerf,
  edgeTrim,
  progress,
}: {
  sheets: PlanSheet[];
  parts: GuidePart[];
  stockLabels: Record<string, string>;
  kerf: number;
  edgeTrim: number;
  /** Absent on the planning page; canTick only for the operator working the job. */
  progress?: { taskId: string; done: string[]; canTick: boolean };
}) {
  const guides = useMemo(() => sheets.map((s) => cuttingSteps(s)), [sheets]);
  const byRef = useMemo(() => new Map(parts.map((p) => [p.ref, p])), [parts]);
  const fills = useMemo(() => new Map(parts.map((p) => [p.ref, p.fill])), [parts]);
  const code = (ref: string, copy: number) => `${byRef.get(ref)?.no ?? "?"}.${copy}`;

  const [done, setDone] = useState(() => new Set(progress?.done ?? []));
  const firstOpen = (i: number) => {
    const steps = guides[i] ?? [];
    const at = steps.findIndex((s) => !done.has(s.key));
    return at === -1 ? (progress && steps.length ? steps.length : 0) : at;
  };
  const [board, setBoard] = useState(() => Math.max(0, guides.findIndex((g, i) => g && firstOpen(i) < g.length)));
  const [pos, setPos] = useState<Record<number, number>>(() => Object.fromEntries(guides.map((_, i) => [i, firstOpen(i)])));
  const [pending, startTransition] = useTransition();

  if (sheets.length === 0) return null;
  const sheet = sheets[board];
  const steps = guides[board];
  const current = Math.min(pos[board] ?? 0, steps?.length ?? 0);
  const step: GuideStep | undefined = steps?.[current];
  const canTick = Boolean(progress?.canTick);

  const go = (i: number) => setPos((p) => ({ ...p, [board]: Math.max(0, Math.min(i, steps?.length ?? 0)) }));

  function tick(key: string, value: boolean) {
    if (!progress) return;
    setDone((d) => {
      const next = new Set(d);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
    startTransition(async () => {
      const result = await markCutAction(progress.taskId, key, value);
      if (!result.ok) {
        toast.error(result.error);
        setDone((d) => {
          const next = new Set(d);
          if (value) next.delete(key);
          else next.add(key);
          return next;
        });
      }
    });
  }

  const boardDone = (i: number) => (guides[i] ?? []).filter((s) => done.has(s.key)).length;
  const describeSource = (s: GuideStep) =>
    s.sourceStep === null
      ? `${edgeTrim > 0 ? "the trimmed board" : "the whole board"} (${s.source.w} × ${s.source.h} mm)`
      : `the ${s.source.w} × ${s.source.h} mm piece from cut ${s.sourceStep}`;

  return (
    <div className="space-y-4">
      {sheets.length > 1 && (
        <div role="tablist" aria-label="Boards" className="flex flex-wrap gap-2">
          {sheets.map((s, i) => {
            const total = guides[i]?.length ?? 0;
            const finished = progress && total > 0 && boardDone(i) === total;
            return (
              <button
                key={s.index}
                type="button"
                role="tab"
                aria-selected={i === board}
                onClick={() => setBoard(i)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium",
                  i === board ? "bg-brand-charcoal text-white" : "bg-muted hover:bg-muted/70",
                )}
              >
                {finished && <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />}
                Board {s.index}
                {progress && total > 0 && <span className="tabular-nums opacity-80">{boardDone(i)}/{total}</span>}
              </button>
            );
          })}
        </div>
      )}

      <Collapsible title="Before you start" open={current === 0}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li>
            Fetch the board: <span className="font-medium">{stockLabels[sheet.stockRef] ?? "stock sheet"}</span>, {sheet.length} × {sheet.width} mm.
          </li>
          <li>Lay it as drawn: the long side runs left to right. Every measurement is from the top or left edge of the piece you are cutting.</li>
          {edgeTrim > 0 && <li>Trim {edgeTrim} mm off every edge first, so the edges are straight and square.</li>}
          <li>The plan allows {kerf} mm for the saw blade. If your blade is thicker, tell the office before cutting.</li>
          {parts.some((p) => p.grain) && <li>Some panels have grain direction set: do not turn them from how they are drawn.</li>}
          <li>Mark each panel with its number (for example 3.2) as it comes off the saw, so edging knows which is which.</li>
        </ul>
      </Collapsible>

      {!steps ? (
        <p className="rounded-lg bg-muted p-4 text-sm">This plan was made before cut details were recorded. Ask the office to generate the plan again to get step-by-step cuts.</p>
      ) : steps.length === 0 ? (
        <p className="rounded-lg bg-muted p-4 text-sm">No cuts needed on this board: the panel is the whole (trimmed) board.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <div className="rounded-lg bg-card p-3">
            <GuideDrawing sheet={sheet} steps={steps} current={current} fills={fills} codes={code} />
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <Key className="bg-[#FBF1E4] ring-2 ring-brand-gold">Piece to cut now</Key>
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 20 4" className="h-1 w-5" aria-hidden>
                  <line x1="0" y1="2" x2="20" y2="2" stroke="#C0392B" strokeWidth="4" strokeDasharray="6 3" />
                </svg>
                Saw line
              </span>
              <Key className="ring-1 ring-brand-charcoal">Panel already cut free</Key>
              <Key className="ring-1 ring-[#AEB5BB]">Not cut free yet</Key>
            </p>
          </div>

          <div className="flex flex-col rounded-lg bg-card p-5">
            {step ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Board {sheet.index} of {sheets.length} · Cut {step.n} of {steps.length}
                  {done.has(step.key) && <span className="font-medium text-brand-gold-deep"> · done</span>}
                </p>
                <h3 className="mt-1 text-xl font-semibold">{step.direction === "along" ? "Cut along the length" : "Cut across"}</h3>
                <p className="mt-2">Take {describeSource(step)}.</p>
                <p className="mt-3 text-4xl font-bold tabular-nums">
                  {step.distance} mm
                  <span className="ml-2 text-base font-normal text-muted-foreground">from the {step.measureFrom} edge</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Set the fence or mark the line at {step.distance} mm. The cut is {step.lineLength} mm long.</p>

                <p className="mt-4 text-sm font-medium">This cut gives you</p>
                <ul className="mt-1 space-y-1.5 text-sm">
                  {step.results.map((r, i) => (
                    <ResultLine key={i} r={r} part={r.kind === "panel" ? byRef.get(r.partRef) : undefined} code={code} />
                  ))}
                </ul>

                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <Button variant="outline" size="lg" className="h-12" disabled={current === 0} onClick={() => go(current - 1)}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                    Back
                  </Button>
                  <Button
                    size="lg"
                    className="h-12 flex-1"
                    disabled={pending}
                    onClick={() => {
                      if (canTick && !done.has(step.key)) tick(step.key, true);
                      go(current + 1);
                    }}
                  >
                    {canTick && !done.has(step.key) ? "Done, next cut" : "Next cut"}
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                  </Button>
                </div>
                {progress && !canTick && <p className="mt-2 text-xs text-muted-foreground">Start or resume the job to tick cuts off as you go.</p>}
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold">Board {sheet.index} is finished</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {sheet.placements.length} panel{sheet.placements.length === 1 ? "" : "s"} from this board. Check each is marked with its number.
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <Button variant="outline" size="lg" className="h-12" onClick={() => go(current - 1)}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                    Back
                  </Button>
                  {board < sheets.length - 1 && (
                    <Button size="lg" className="h-12 flex-1" onClick={() => setBoard(board + 1)}>
                      Next board
                      <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {steps && steps.length > 0 && (
        <Collapsible title={`All ${steps.length} cuts on board ${sheet.index}`}>
          <ol className="divide-y divide-border text-sm">
            {steps.map((s, i) => (
              <li key={s.key} className={cn("flex items-center gap-3 py-2", i === current && "font-medium")}>
                {progress && (
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 cursor-pointer accent-brand-charcoal disabled:cursor-default"
                    aria-label={`Cut ${s.n} done`}
                    checked={done.has(s.key)}
                    disabled={!canTick || pending}
                    onChange={(e) => tick(s.key, e.target.checked)}
                  />
                )}
                <button type="button" onClick={() => go(i)} className="flex-1 cursor-pointer text-left hover:underline">
                  <span className="tabular-nums">{s.n}.</span> {s.direction === "along" ? "Along" : "Across"} the {s.source.w} × {s.source.h} piece, {s.distance} mm from the {s.measureFrom}
                </button>
              </li>
            ))}
          </ol>
        </Collapsible>
      )}
    </div>
  );
}

function ResultLine({ r, part, code }: { r: GuideResult; part?: GuidePart; code: (ref: string, copy: number) => string }) {
  const size = `${r.rect.w} × ${r.rect.h} mm`;
  if (r.kind === "panel") {
    return (
      <li className="flex items-start gap-2">
        <span className="mt-0.5 size-4 shrink-0 rounded-sm ring-1 ring-brand-charcoal" style={{ background: part?.fill }} aria-hidden />
        <span>
          <span className="font-semibold">Panel {code(r.partRef, r.copy)}</span> {part?.label && `· ${part.label}`} · {size}
          {part && part.edges !== "None" && <span className="block text-muted-foreground">Edge banding: {part.edges}</span>}
        </span>
      </li>
    );
  }
  if (r.kind === "piece") {
    return (
      <li className="flex items-start gap-2">
        <span className="mt-0.5 size-4 shrink-0 rounded-sm bg-[#FBF1E4] ring-1 ring-brand-gold" aria-hidden />
        <span>
          A {size} piece: <span className="font-medium">cut again in step {r.nextStep}</span>
        </span>
      </li>
    );
  }
  return (
    <li className="flex items-start gap-2 text-muted-foreground">
      <span className="mt-0.5 size-4 shrink-0 rounded-sm bg-muted ring-1 ring-border" aria-hidden />
      <span>Offcut {size}</span>
    </li>
  );
}

function Key({ className, children }: { className: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-3 w-5 rounded-sm", className)} aria-hidden />
      {children}
    </span>
  );
}
