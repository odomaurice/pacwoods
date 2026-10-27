import type { Metadata } from "next";
import StatTile from "@/components/dashboard/StatTile";
import EmptyState from "@/components/EmptyState";
import ExportButtons from "@/components/ExportButtons";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reportPeriod } from "@/lib/report-period";
import { requireRole } from "@/server/auth/guards";
import { materialUsage, productionReport } from "@/server/exports/reports";

export const metadata: Metadata = { title: "Reports | Pacwoods" };

const n = (x: number) => x.toLocaleString("en-GB");

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const period = reportPeriod(one(sp.from), one(sp.to));
  const [report, materials] = await Promise.all([productionReport(period.from, period.to), materialUsage(period.from, period.to)]);

  const stages = report.rows.length;
  const hours = report.rows.reduce((h, r) => h + r.activeMin, 0) / 60;
  const panels = report.rows.reduce((t, r) => t + r.panels, 0);
  const defects = report.rows.reduce((t, r) => t + r.defects + r.waste, 0);
  const downtime = report.rows.reduce((t, r) => t + r.downtime, 0);
  const sheets = materials.reduce((t, m) => t + m.sheets, 0);
  const area = materials.reduce((t, m) => t + m.area, 0);
  const used = materials.reduce((t, m) => t + m.used, 0);
  const query = `from=${period.fromDay}&to=${period.toDay}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Completed production work and board used in a period. Every figure comes from recorded work." />

      <form className="flex flex-wrap items-end gap-3 rounded-lg bg-card p-4">
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">From</span>
          <Input type="date" name="from" defaultValue={period.fromDay} className="h-10" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">To</span>
          <Input type="date" name="to" defaultValue={period.toDay} className="h-10" />
        </label>
        <Button type="submit" className="h-10">
          Show
        </Button>
        <span className="ml-auto">
          <ExportButtons href={`/api/exports/production?${query}`} label="Production report" />
        </span>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Stages completed" value={stages} href="#by-operator" />
        <StatTile label="Hours of machine work" value={Math.round(hours * 10) / 10} href="#by-operator" />
        <StatTile label="Panels produced" value={panels} href="#by-operator" />
        <StatTile label="Waste and defective panels" value={defects} href="#by-operator" alert />
        <StatTile label="Downtime, minutes" value={downtime} href="#by-operator" />
        <StatTile label="Sheets planned" value={sheets} href="#materials" />
      </div>

      <section id="by-operator" aria-labelledby="ops" className="space-y-3">
        <h2 id="ops" className="text-lg font-semibold">
          By operator
        </h2>
        {report.operators.length === 0 ? (
          <EmptyState title="No production work was completed in this period." />
        ) : (
          <div className="rounded-lg bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operator</TableHead>
                  <TableHead className="text-right">Stages</TableHead>
                  <TableHead className="text-right">Active hours</TableHead>
                  <TableHead className="text-right">Avg per stage</TableHead>
                  <TableHead className="text-right">Panels</TableHead>
                  <TableHead className="text-right">Waste</TableHead>
                  <TableHead className="text-right">Defective</TableHead>
                  <TableHead className="text-right">Downtime min</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.operators.map((o) => (
                  <TableRow key={o.operator}>
                    <TableCell className="font-medium">{o.operator || "Unknown"}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.stages}</TableCell>
                    <TableCell className="text-right tabular-nums">{(o.minutes / 60).toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round(o.minutes / o.stages)} min</TableCell>
                    <TableCell className="text-right tabular-nums">{n(o.panels)}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.waste}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.defects}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.downtime}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section id="materials" aria-labelledby="mat" className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 id="mat" className="text-lg font-semibold">
            Board used by material
          </h2>
          {area > 0 && <span className="text-sm text-muted-foreground">Overall {((used / area) * 100).toFixed(1)}% of board used, from plans approved in this period</span>}
        </div>
        {materials.length === 0 ? (
          <EmptyState title="No cutting plans were approved in this period." />
        ) : (
          <div className="rounded-lg bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Sheets</TableHead>
                  <TableHead className="text-right">Board used</TableHead>
                  <TableHead className="text-right">Waste m²</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m) => (
                  <TableRow key={m.material}>
                    <TableCell className="font-medium">{m.material}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.sheets}</TableCell>
                    <TableCell className="text-right tabular-nums">{((m.used / m.area) * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{((m.area - m.used) / 1_000_000).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
