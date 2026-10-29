"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, SunburstChart, Tooltip, XAxis, YAxis } from "recharts";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/jobs";

/**
 * Pacwoods chart palette, in fixed order: wood gold, blue, green, rust, plum.
 * Validated on the white card surface (dataviz validator): CVD and
 * normal-vision separation pass and every slot clears 3:1 contrast. Charts
 * still carry labels and a table view so colour is never the only cue.
 */
const SERIES = ["#c27a2c", "#2f6db5", "#2f9a68", "#a8473a", "#8a6bb0"] as const;
const INK = "#1b2328";
const MUTED = "#5b6670";
const GRID = "#e5e7e9";

const PHASES: Array<{ name: string; color: string; statuses: JobStatus[] }> = [
  { name: "Preparation", color: SERIES[1], statuses: ["DRAFT", "AWAITING_APPROVAL", "AWAITING_MATERIAL"] },
  { name: "Cutting", color: SERIES[0], statuses: ["QUEUED_FOR_CUTTING", "CUTTING_IN_PROGRESS"] },
  { name: "Edging", color: SERIES[2], statuses: ["AWAITING_EDGING", "QUEUED_FOR_EDGING", "EDGING_IN_PROGRESS", "AWAITING_QUALITY_CHECK"] },
  { name: "Finished", color: SERIES[4], statuses: ["COMPLETED"] },
  { name: "Stopped", color: SERIES[3], statuses: ["ON_HOLD", "CANCELLED"] },
];

function ChartFrame({ title, description, children, table }: { title: string; description?: string; children: ReactNode; table: ReactNode }) {
  return (
    <section className="flex flex-col rounded-lg bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mb-3 text-sm text-muted-foreground">{description}</p>}
      <div className="flex-1">{children}</div>
      <details className="mt-3 text-sm">
        <summary className="text-muted-foreground hover:text-foreground">Show as table</summary>
        <div className="mt-2">{table}</div>
      </details>
    </section>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-muted-foreground">
        <tr>
          {head.map((h, i) => (
            <th key={h} className={i ? "py-1 text-right font-medium" : "py-1 font-medium"}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border">
            {r.map((c, j) => (
              <td key={j} className={j ? "py-1 text-right tabular-nums" : "py-1"}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const tooltipStyle = { borderRadius: 8, border: "1px solid #dcdee0", color: INK, fontSize: 13 };

/** Jobs by phase (inner ring) and status (outer ring). Click a status to list those jobs. */
export function JobsSunburst({ byStatus }: { byStatus: Partial<Record<JobStatus, number>> }) {
  const router = useRouter();
  const phases = PHASES.map((p) => {
    const children = p.statuses
      .filter((s) => (byStatus[s] ?? 0) > 0)
      .map((s) => ({ name: JOB_STATUS_LABELS[s], value: byStatus[s] ?? 0, fill: p.color, status: s }));
    return { name: p.name, fill: p.color, value: children.reduce((a, c) => a + c.value, 0), children };
  }).filter((p) => p.value > 0);
  const total = phases.reduce((a, p) => a + p.value, 0);

  return (
    <ChartFrame
      title="Jobs by stage"
      description="Inner ring: phase. Outer ring: status. Click a segment to open those jobs."
      table={<SimpleTable head={["Status", "Jobs"]} rows={phases.flatMap((p) => p.children.map((c) => [`${p.name} · ${c.name}`, c.value]))} />}
    >
      {total === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No jobs yet.</p>
      ) : (
        <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
          <div className="mx-auto aspect-square w-full max-w-72">
            <SunburstChart
              responsive
              width="100%"
              height="100%"
              data={{ name: "Jobs", children: phases }}
              innerRadius={36}
              ringPadding={2}
              stroke="#ffffff"
              textOptions={{ fill: "transparent", stroke: "none" }}
              onClick={(node) => {
                if (node.status) router.push(`/admin/jobs?status=${node.status}`);
              }}
              style={{ cursor: "pointer" }}
            >
              <Tooltip contentStyle={tooltipStyle} />
            </SunburstChart>
          </div>
          <ul className="space-y-2 text-sm">
            {phases.map((p) => (
              <li key={p.name}>
                <span className="flex items-center gap-2 font-medium">
                  <span aria-hidden className="size-3 rounded-sm" style={{ background: p.fill }} />
                  {p.name} <span className="ml-auto pl-3 tabular-nums">{p.value}</span>
                </span>
                <ul className="mt-0.5 ml-5 space-y-0.5 text-muted-foreground">
                  {p.children.map((c) => (
                    <li key={c.status}>
                      <a href={`/admin/jobs?status=${c.status}`} className="flex gap-3 hover:text-foreground hover:underline">
                        {c.name} <span className="ml-auto tabular-nums">{c.value}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartFrame>
  );
}

type Daily = Array<{ day: string; label: string; jobs: number }>;

export function JobsPerDayChart({ data }: { data: Daily }) {
  return <DailyBarChart data={data} title="Jobs registered" unit="Jobs" />;
}

/** One count per day, single series: the title names it, so no legend box. */
export function DailyBarChart({ data, title, unit }: { data: Daily; title: string; unit: string }) {
  const total = data.reduce((a, d) => a + d.jobs, 0);
  return (
    <ChartFrame title={title} description={`Last 14 days · ${total} in total`} table={<SimpleTable head={["Day", unit]} rows={data.map((d) => [d.label, d.jobs])} />}>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: "#f1f2f3" }} contentStyle={tooltipStyle} formatter={(v) => [v, unit]} />
            <Bar dataKey="jobs" name={unit} fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/** Open work per operator, split by stage. Click a bar to open the operator. */
export function WorkloadChart({ data }: { data: Array<{ id: string; name: string; cutting: number; edging: number }> }) {
  const router = useRouter();
  const height = useMemo(() => Math.max(120, data.length * 44 + 60), [data.length]);
  return (
    <ChartFrame
      title="Operator workload"
      description="Assigned work not yet completed. Click a bar to open the operator."
      table={<SimpleTable head={["Operator", "Cutting", "Edging"]} rows={data.map((d) => [d.name, d.cutting, d.edging])} />}
    >
      {data.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No operator has taken any work yet.</p>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }} barCategoryGap={8}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fill: INK, fontSize: 13 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "#f1f2f3" }} contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" align="left" iconType="square" wrapperStyle={{ fontSize: 13, color: INK, paddingBottom: 8 }} />
              <Bar dataKey="cutting" name="Cutting" stackId="w" fill={SERIES[0]} stroke="#ffffff" strokeWidth={2} onClick={(d) => router.push(`/admin/accounts/${(d as { id?: string }).id}`)} style={{ cursor: "pointer" }} />
              <Bar dataKey="edging" name="Edging" stackId="w" fill={SERIES[2]} stroke="#ffffff" strokeWidth={2} radius={[0, 4, 4, 0]} onClick={(d) => router.push(`/admin/accounts/${(d as { id?: string }).id}`)} style={{ cursor: "pointer" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  );
}

export function SheetsByMaterialChart({ data }: { data: Array<{ material: string; sheets: number }> }) {
  const height = Math.max(120, data.length * 40 + 30);
  return (
    <ChartFrame
      title="Sheets planned by material"
      description="Approved cutting plans, last 90 days"
      table={<SimpleTable head={["Material", "Sheets"]} rows={data.map((d) => [d.material, d.sheets])} />}
    >
      {data.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No approved cutting plans yet.</p>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap={8}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="material" width={150} tick={{ fill: INK, fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "#f1f2f3" }} contentStyle={tooltipStyle} formatter={(v) => [v, "Sheets"]} />
              <Bar dataKey="sheets" name="Sheets" fill={SERIES[1]} radius={[0, 4, 4, 0]} label={{ position: "right", fill: INK, fontSize: 12 }} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  );
}
