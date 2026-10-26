import { optimise } from "@/lib/cutting/engine";
import { PART_FILLS } from "@/lib/plan-view";

const GOLD = "#D99E56";
const INK = "#1B2328";

/**
 * The hero illustration is a real plan from the cutting engine. Panels drop
 * onto the sheet one by one, then the saw cuts draw in, in their real order.
 */
export default function HeroPlan() {
  const e = (l1: boolean, l2: boolean, w1 = false, w2 = false) => ({ length1: l1, length2: l2, width1: w1, width2: w2 });
  const parts = [
    { ref: "A", label: "Side", length: 720, width: 560, quantity: 2, grain: "NONE" as const, edges: e(true, false) },
    { ref: "B", label: "Shelf", length: 764, width: 520, quantity: 2, grain: "NONE" as const, edges: e(true, false) },
    { ref: "C", label: "Door", length: 715, width: 396, quantity: 2, grain: "NONE" as const, edges: e(true, true, true, true) },
    { ref: "D", label: "Drawer", length: 560, width: 180, quantity: 3, grain: "NONE" as const, edges: e(true, false) },
  ];
  const plan = optimise(parts, [{ ref: "S", length: 2440, width: 1220, quantity: 1, grained: false }], {
    kerf: 4,
    edgeTrim: 0,
    considerMaterial: false,
    considerGrain: false,
    deductEdgeBanding: false,
    edgeBandThickness: 1,
    singleSheet: true,
  });
  const sheet = plan.sheets[0];
  if (!sheet) return null;
  const byRef = new Map(parts.map((p, i) => [p.ref, { ...p, fill: PART_FILLS[i] }]));
  const band = 14;
  const panelDelay = (i: number) => 300 + i * 220;
  const cutStart = panelDelay(sheet.placements.length) + 300;

  return (
    <figure className="pw-float relative">
      <svg viewBox="-40 -40 2520 1300" className="h-auto w-full drop-shadow-2xl" role="img" aria-label={`A cutting plan: ${sheet.placements.length} panels on one 2440 by 1220 millimetre sheet, ${Math.round(sheet.utilization * 100)} percent used`}>
        <rect x={0} y={0} width={2440} height={1220} rx={6} fill="#F7F3EC" />
        {sheet.offcuts.map((o, i) => (
          <rect key={`o${i}`} x={o.x} y={o.y} width={o.w} height={o.h} fill="#ECE6DB" />
        ))}
        {sheet.placements.map((p, i) => {
          const part = byRef.get(p.partRef)!;
          const ed = part.edges;
          const top = p.rotated ? ed.width1 : ed.length1;
          const bottom = p.rotated ? ed.width2 : ed.length2;
          const left = p.rotated ? ed.length1 : ed.width1;
          const right = p.rotated ? ed.length2 : ed.width2;
          const fs = Math.min(64, p.w / 6, p.h / 3);
          return (
            <g key={`${p.partRef}${p.copy}`} className="pw-panel" style={{ animationDelay: `${panelDelay(i)}ms` }}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={part.fill} stroke={INK} strokeWidth={4} />
              {top && <rect x={p.x} y={p.y} width={p.w} height={band} fill={GOLD} />}
              {bottom && <rect x={p.x} y={p.y + p.h - band} width={p.w} height={band} fill={GOLD} />}
              {left && <rect x={p.x} y={p.y} width={band} height={p.h} fill={GOLD} />}
              {right && <rect x={p.x + p.w - band} y={p.y} width={band} height={p.h} fill={GOLD} />}
              {fs > 22 && (
                <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill={INK} fontWeight={600}>
                  {part.label}
                </text>
              )}
            </g>
          );
        })}
        {sheet.cuts.map((c, i) => (
          <line
            key={c.order}
            x1={c.x1}
            y1={c.y1}
            x2={c.x2}
            y2={c.y2}
            pathLength={1}
            className="pw-cut"
            style={{ animationDelay: `${cutStart + i * 120}ms` }}
            stroke="#C0392B"
            strokeOpacity={0.75}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}
        <rect x={0} y={0} width={2440} height={1220} rx={6} fill="none" stroke={INK} strokeWidth={10} />
      </svg>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/80">
        <span>
          <span className="mr-2 inline-block size-2.5 rounded-sm bg-brand-gold align-middle" aria-hidden />
          Edge banding
          <span className="mx-2 inline-block h-0.5 w-4 bg-[#C0392B] align-middle" aria-hidden />
          Saw cuts, in order
        </span>
        <span className="font-semibold text-brand-gold">{Math.round(sheet.utilization * 100)}% of the sheet used</span>
      </figcaption>
    </figure>
  );
}
