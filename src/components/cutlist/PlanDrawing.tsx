import type { Edges, PlanSheet, Rect } from "@/lib/cutting/types";

export type DrawPart = { ref: string; label: string; fill: string; edges: Edges };

const INK = "#1B2328";
const SLATE = "#5B6670";
const RULER = "#C0392B";
const GOLD = "#D99E56";
const OFFCUT = "#F3F4F4";

/**
 * One sheet layout drawn from the stored plan. In portrait the drawing is
 * transposed (sheet length runs down the page) so tall phone screens are used
 * well; every number shown is still the real one.
 */
export default function PlanDrawing({
  sheet,
  parts,
  count,
  stockLabel,
  portrait,
  fontScale,
  rulers,
  showCuts,
  showLabels,
}: {
  sheet: PlanSheet;
  parts: Map<string, DrawPart>;
  count: number;
  stockLabel: string;
  portrait: boolean;
  fontScale: number;
  rulers: boolean;
  showCuts: boolean;
  showLabels: boolean;
}) {
  const T = (r: Rect): Rect => (portrait ? { x: r.y, y: r.x, w: r.h, h: r.w } : r);
  const W = portrait ? sheet.width : sheet.length;
  const H = portrait ? sheet.length : sheet.width;
  const f = Math.max(W, H) * 0.03 * fontScale;
  const stroke = Math.max(W, H) * 0.0025;
  const band = Math.max(W, H) * 0.006;

  const left = f * 0.5;
  const top = f * 1.8;
  const right = rulers ? f * 2.4 : f * 0.5;
  const bottom = rulers ? f * 2.4 : f * 0.5;
  const viewBox = `${-left} ${-top} ${W + left + right + (count > 1 ? f * 3 : 0)} ${H + top + bottom}`;

  return (
    <svg viewBox={viewBox} className="h-auto w-full" role="img" aria-label={`${stockLabel}, ${sheet.length} × ${sheet.width} mm, ${sheet.placements.length} panels`}>
      <text x={W} y={-f * 0.5} textAnchor="end" fontSize={f * 0.8} fill={SLATE}>
        {stockLabel}
      </text>

      <rect x={0} y={0} width={W} height={H} fill="#FFFFFF" />

      {sheet.offcuts.map((o, i) => {
        const r = T(o);
        const fs = Math.min(f * 0.7, r.w / 3, r.h / 3);
        return (
          <g key={`o${i}`}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={OFFCUT} stroke="#C9CDD1" strokeWidth={stroke / 2} />
            {fs > f * 0.3 && (
              <>
                <text x={r.x + r.w / 2} y={r.y + fs * 1.1} textAnchor="middle" fontSize={fs} fill="#8A949C">
                  {r.w}
                </text>
                <text x={r.x + fs * 1.1} y={r.y + r.h / 2} textAnchor="middle" fontSize={fs} fill="#8A949C" transform={`rotate(-90 ${r.x + fs * 1.1} ${r.y + r.h / 2})`}>
                  {r.h}
                </text>
              </>
            )}
          </g>
        );
      })}

      {sheet.placements.map((p) => {
        const part = parts.get(p.partRef);
        const r = T(p);
        const e = part?.edges;
        // Sides of the panel as drawn: unrotated, the long (length) edges are top and bottom.
        const base = e && {
          top: p.rotated ? e.width1 : e.length1,
          bottom: p.rotated ? e.width2 : e.length2,
          left: p.rotated ? e.length1 : e.width1,
          right: p.rotated ? e.length2 : e.width2,
        };
        const sides = base && (portrait ? { top: base.left, left: base.top, bottom: base.right, right: base.bottom } : base);
        const fs = Math.min(f * 0.8, r.w / 4, r.h / 4);
        const tall = r.h > r.w * 1.3;
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        return (
          <g key={`${p.partRef}#${p.copy}`}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={part?.fill ?? "#EEE"} stroke={INK} strokeWidth={stroke} />
            {sides?.top && <rect x={r.x} y={r.y} width={r.w} height={band} fill={GOLD} />}
            {sides?.bottom && <rect x={r.x} y={r.y + r.h - band} width={r.w} height={band} fill={GOLD} />}
            {sides?.left && <rect x={r.x} y={r.y} width={band} height={r.h} fill={GOLD} />}
            {sides?.right && <rect x={r.x + r.w - band} y={r.y} width={band} height={r.h} fill={GOLD} />}
            {fs > f * 0.3 && (
              <>
                <text x={cx} y={r.y + fs * 1.3} textAnchor="middle" fontSize={fs} fill={INK}>
                  {r.w}
                </text>
                <text x={r.x + fs * 1.3} y={cy} textAnchor="middle" fontSize={fs} fill={INK} transform={`rotate(-90 ${r.x + fs * 1.3} ${cy})`}>
                  {r.h}
                </text>
                {showLabels && part?.label && (
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill={SLATE} transform={tall ? `rotate(-90 ${cx} ${cy})` : undefined}>
                    {part.label}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}

      <rect x={0} y={0} width={W} height={H} fill="none" stroke={INK} strokeWidth={stroke * 2} />

      {showCuts &&
        sheet.cuts.map((c) => {
          const a = T({ x: c.x1, y: c.y1, w: 0, h: 0 });
          const b = T({ x: c.x2, y: c.y2, w: 0, h: 0 });
          const rr = f * 0.45;
          return (
            <g key={`c${c.order}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={RULER} strokeWidth={stroke * 1.5} />
              <circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={rr} fill={RULER} />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} textAnchor="middle" dominantBaseline="central" fontSize={rr * 1.1} fill="#FFFFFF">
                {c.order}
              </text>
            </g>
          );
        })}

      {rulers && (
        <g stroke={RULER} strokeWidth={stroke}>
          {/* Bottom ruler: drawn width */}
          <line x1={0} y1={H + f * 0.9} x2={W} y2={H + f * 0.9} />
          <line x1={0} y1={H + f * 0.5} x2={0} y2={H + f * 1.3} />
          <line x1={W} y1={H + f * 0.5} x2={W} y2={H + f * 1.3} />
          <text x={W / 2} y={H + f * 2.1} textAnchor="middle" fontSize={f * 0.8} fill={RULER} stroke="none">
            {W}
          </text>
          {/* Right ruler: drawn height */}
          <line x1={W + f * 0.9} y1={0} x2={W + f * 0.9} y2={H} />
          <line x1={W + f * 0.5} y1={0} x2={W + f * 1.3} y2={0} />
          <line x1={W + f * 0.5} y1={H} x2={W + f * 1.3} y2={H} />
          <text x={W + f * 1.9} y={H / 2} textAnchor="middle" fontSize={f * 0.8} fill={RULER} stroke="none" transform={`rotate(-90 ${W + f * 1.9} ${H / 2})`}>
            {H}
          </text>
        </g>
      )}

      {count > 1 && (
        <text x={W + right + f * 0.4} y={H} fontSize={f * 1.6} fill={INK}>
          ×{count}
        </text>
      )}
    </svg>
  );
}
