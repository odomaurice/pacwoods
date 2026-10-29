import type { PlanSheet, Rect } from "@/lib/cutting/types";
import type { GuideStep } from "@/lib/cutting/guide";

const INK = "#1B2328";
const SLATE = "#5B6670";
const SAW = "#C0392B";
const GOLD = "#D99E56";
const SOURCE = "#FBF1E4";
const PAST = "#AEB5BB";

const key = (r: Rect) => `${r.x},${r.y},${r.w},${r.h}`;

/**
 * The board as it is when the operator reaches one step: panels already cut
 * free in their colour, panels still inside uncut pieces as outlines, the
 * piece to cut now highlighted, and the saw line with its measurement.
 */
export default function GuideDrawing({
  sheet,
  steps,
  current,
  fills,
  codes,
}: {
  sheet: PlanSheet;
  steps: GuideStep[];
  /** Index into steps; steps.length means the board is finished. */
  current: number;
  fills: Map<string, string>;
  codes: (partRef: string, copy: number) => string;
}) {
  const W = sheet.length;
  const H = sheet.width;
  const f = Math.max(W, H) * 0.035;
  const stroke = Math.max(W, H) * 0.0022;
  const step = steps[current];

  // Pieces separated by the steps before this one.
  const free = new Set(steps.slice(0, current).flatMap((s) => s.cut.pieces!.filter((p): p is Rect => p !== null).map(key)));
  const anyCuts = steps.length > 0;
  const isFree = (r: Rect) => !anyCuts || free.has(key(r)) || current >= steps.length;

  const s = step?.source;
  const c = step?.cut;
  const label = step
    ? `Cut ${step.n} of ${steps.length}: ${step.distance} mm from the ${step.measureFrom} edge of the ${s!.w} by ${s!.h} mm piece`
    : `Board finished: ${sheet.placements.length} panels`;

  return (
    <svg viewBox={`${-f * 0.6} ${-f * 0.6} ${W + f * 1.2} ${H + f * 1.2}`} className="h-auto w-full" role="img" aria-label={label}>
      <rect x={0} y={0} width={W} height={H} fill="#FFFFFF" stroke={INK} strokeWidth={stroke * 2} />

      {s && <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={SOURCE} stroke={GOLD} strokeWidth={stroke * 3} />}

      {sheet.placements.map((p) => {
        const freed = isFree(p);
        const fs = Math.min(f, p.w / 3.5, p.h / 2.2);
        return (
          <g key={`${p.partRef}#${p.copy}`}>
            <rect
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              fill={freed ? (fills.get(p.partRef) ?? "#EEE") : "none"}
              stroke={freed ? INK : PAST}
              strokeWidth={stroke}
              strokeDasharray={freed ? undefined : `${stroke * 6} ${stroke * 4}`}
            />
            {fs > f * 0.35 && (
              <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={600} fill={freed ? INK : SLATE}>
                {codes(p.partRef, p.copy)}
              </text>
            )}
          </g>
        );
      })}

      {steps.slice(0, current).map((d) => (
        <line key={d.key} x1={d.cut.x1} y1={d.cut.y1} x2={d.cut.x2} y2={d.cut.y2} stroke={PAST} strokeWidth={stroke * 1.5} />
      ))}

      {step && c && s && (
        <g>
          <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke={SAW} strokeWidth={stroke * 4} strokeDasharray={`${stroke * 10} ${stroke * 5}`} />
          {/* Dimension from the measured edge to the saw line. */}
          {step.measureFrom === "top" ? (
            // Close to the left edge, clear of the panel numbers in the middle.
            <Dimension x1={s.x + f * 2} y1={s.y} x2={s.x + f * 2} y2={s.y + step.distance} text={`${step.distance}`} f={f} stroke={stroke} vertical labelAt={0.25} />
          ) : (
            <Dimension x1={s.x} y1={s.y + f * 1.2} x2={s.x + step.distance} y2={s.y + f * 1.2} text={`${step.distance}`} f={f} stroke={stroke} />
          )}
        </g>
      )}
    </svg>
  );
}

function Dimension({ x1, y1, x2, y2, text, f, stroke, vertical, labelAt = 0.5 }: { x1: number; y1: number; x2: number; y2: number; text: string; f: number; stroke: number; vertical?: boolean; labelAt?: number }) {
  const mx = x1 + (x2 - x1) * labelAt;
  const my = y1 + (y2 - y1) * labelAt;
  const tick = f * 0.35;
  return (
    <g stroke={SAW} strokeWidth={stroke * 2}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} />
          <line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} />
          <line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} />
        </>
      )}
      <rect x={mx - f * 1.6} y={my - f * 0.6} width={f * 3.2} height={f * 1.2} rx={f * 0.2} fill={SAW} stroke="none" />
      <text x={mx} y={my} textAnchor="middle" dominantBaseline="central" fontSize={f * 0.85} fontWeight={700} fill="#FFFFFF" stroke="none">
        {text}
      </text>
    </g>
  );
}
