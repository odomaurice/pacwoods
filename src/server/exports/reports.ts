import "server-only";
import type { Types } from "mongoose";
import { GRAIN_LABELS, describeEdges } from "@/lib/cutlist";
import { JOB_STATUS_LABELS, describeOperations, type JobStatus } from "@/lib/jobs";
import type { Table } from "@/lib/export-table";
import { STAGE_LABELS, type Stage } from "@/lib/production";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { CutlistVersion } from "@/server/db/models/CutlistVersion";
import { Job } from "@/server/db/models/Job";
import { ProcessingSession } from "@/server/db/models/ProcessingSession";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { User } from "@/server/db/models/User";
import { getCutlists } from "@/server/services/cutlists";
import { listJobs } from "@/server/services/jobs";

/**
 * A job's cutlist as tables. Clients get the approved version only; staff
 * get the approved version, or the draft if nothing is approved yet. The
 * exported version is named in every sheet so it can be matched later.
 */
export async function cutlistTables(workNumber: string, viewer: { id: string; role: string }) {
  await connectDb();
  const job = await Job.findOne({ workNumber }).lean();
  if (!job) return null;
  if (viewer.role === "CLIENT") {
    const owns = await ClientProfile.exists({ _id: job.clientId, userId: viewer.id });
    if (!owns) return null;
  } else if (viewer.role !== "SUPER_ADMIN" && viewer.role !== "ADMIN") {
    return null;
  }
  const { approved, draft } = await getCutlists(job._id);
  const version = approved ?? (viewer.role === "CLIENT" ? null : draft);
  if (!version) return null;
  const tag = `v${version.version} ${version.state === "APPROVED" ? "approved" : "draft"}`;

  const panels: Table = {
    name: "Panels",
    headers: ["Work no.", "Version", "#", "Label", "Length mm", "Width mm", "Qty", "Material", "Thickness mm", "Grain", "Edge banding", "Long edge 1", "Long edge 2", "Short edge 1", "Short edge 2"],
    widths: [17, 13, 5, 18, 11, 11, 6, 26, 13, 15, 24, 11, 11, 11, 11],
    rows: version.parts.map((p, i) => [
      job.workNumber,
      tag,
      i + 1,
      p.label ?? "",
      p.length,
      p.width,
      p.quantity,
      p.materialName ?? "",
      p.thicknessMm ?? null,
      GRAIN_LABELS[p.grain],
      describeEdges(p.edges),
      p.edges.length1 ? "Yes" : "No",
      p.edges.length2 ? "Yes" : "No",
      p.edges.width1 ? "Yes" : "No",
      p.edges.width2 ? "Yes" : "No",
    ]),
  };
  const stock: Table = {
    name: "Stock sheets",
    headers: ["Label", "Length mm", "Width mm", "Qty available", "Material", "Thickness mm", "Grain along length"],
    widths: [18, 11, 11, 14, 26, 13, 18],
    rows: version.stockSheets.map((s) => [s.label ?? "", s.length, s.width, s.quantity, s.materialName ?? "", s.thicknessMm ?? null, s.grained ? "Yes" : "No"]),
  };
  const tables: Table[] = [panels, stock];
  if (version.plan) {
    const stockByRef = new Map(version.stockSheets.map((s) => [s.ref, s]));
    tables.push({
      name: "Cutting plan",
      headers: ["Sheet", "Size mm", "Material", "Panels", "Used %", "Cuts", "Cut length mm"],
      widths: [8, 14, 26, 9, 9, 7, 14],
      rows: version.plan.sheets.map((s) => [
        s.index,
        `${s.length} × ${s.width}`,
        stockByRef.get(s.stockRef)?.materialName ?? "",
        s.placements.length,
        Math.round(s.utilization * 1000) / 10,
        s.cuts.length,
        s.cuts.reduce((n, c) => n + Math.abs(c.x2 - c.x1) + Math.abs(c.y2 - c.y1), 0),
      ]),
    });
  }
  return { workNumber: job.workNumber, tables, tag };
}

export async function jobListTable(filters: { q?: string; status?: string }): Promise<Table> {
  const rows: Table["rows"] = [];
  for (let page = 1; ; page++) {
    const { rows: chunk, pages } = await listJobs({ ...filters, page });
    for (const j of chunk) {
      rows.push([j.workNumber, j.client.clientNumber, j.client.businessName ?? j.client.name, j.title ?? "", describeOperations(j.operations), JOB_STATUS_LABELS[j.status as JobStatus], j.createdAt]);
    }
    if (page >= pages || page >= 200) break;
  }
  return { name: "Jobs", headers: ["Work no.", "Client no.", "Client", "Title", "Operations", "Status", "Registered"], widths: [17, 12, 28, 28, 20, 22, 18], rows };
}

/** Completed production stages in a period: who, how long, and what came out. */
export async function productionReport(from: Date, to: Date) {
  await connectDb();
  const tasks = await ProductionTask.find({ status: "COMPLETED", completedAt: { $gte: from, $lte: to } }).sort({ completedAt: 1 }).lean();
  const [sessions, users, jobs] = await Promise.all([
    ProcessingSession.find({ taskId: { $in: tasks.map((t) => t._id) } }).lean(),
    User.find({ _id: { $in: tasks.map((t) => t.completedBy).filter(Boolean) } }).select("name").lean(),
    Job.find({ _id: { $in: tasks.map((t) => t.jobId) } }).select("workNumber clientId").lean(),
  ]);
  const profiles = await ClientProfile.find({ _id: { $in: jobs.map((j) => j.clientId) } }).select("clientNumber businessName userId").lean();
  const name = new Map(users.map((u) => [u._id.toString(), u.name]));
  const jobById = new Map(jobs.map((j) => [j._id.toString(), j]));
  const profileById = new Map(profiles.map((p) => [p._id.toString(), p]));
  const minutes = (taskId: Types.ObjectId) =>
    Math.round(sessions.filter((s) => s.taskId.equals(taskId)).reduce((ms, s) => ms + ((s.endedAt ?? s.startedAt).getTime() - s.startedAt.getTime()), 0) / 60000);

  const rows = tasks.map((t) => {
    const job = jobById.get(t.jobId.toString());
    const client = job ? profileById.get(job.clientId.toString()) : undefined;
    return {
      workNumber: t.workNumber,
      client: client?.businessName ?? client?.clientNumber ?? "",
      stage: STAGE_LABELS[t.stage as Stage],
      operator: t.completedBy ? (name.get(t.completedBy.toString()) ?? "") : "",
      operatorId: t.completedBy?.toString() ?? "",
      started: t.firstStartedAt ?? null,
      completed: t.completedAt ?? null,
      activeMin: minutes(t._id),
      panels: t.results?.quantityCompleted ?? 0,
      waste: t.results?.wastePanels ?? 0,
      defects: t.results?.defectivePanels ?? 0,
      downtime: t.results?.downtimeMin ?? 0,
    };
  });

  const byOperator = new Map<string, { operator: string; stages: number; minutes: number; panels: number; waste: number; defects: number; downtime: number }>();
  for (const r of rows) {
    const o = byOperator.get(r.operatorId) ?? { operator: r.operator, stages: 0, minutes: 0, panels: 0, waste: 0, defects: 0, downtime: 0 };
    o.stages += 1;
    o.minutes += r.activeMin;
    o.panels += r.panels;
    o.waste += r.waste;
    o.defects += r.defects;
    o.downtime += r.downtime;
    byOperator.set(r.operatorId, o);
  }
  return { rows, operators: [...byOperator.values()].sort((a, b) => b.stages - a.stages) };
}

export function productionTables(report: Awaited<ReturnType<typeof productionReport>>): Table[] {
  return [
    {
      name: "Completed stages",
      headers: ["Work no.", "Client", "Stage", "Operator", "Started", "Completed", "Active minutes", "Panels", "Waste", "Defective", "Downtime min"],
      widths: [17, 26, 9, 20, 18, 18, 15, 8, 7, 10, 14],
      rows: report.rows.map((r) => [r.workNumber, r.client, r.stage, r.operator, r.started, r.completed, r.activeMin, r.panels, r.waste, r.defects, r.downtime]),
    },
    {
      name: "By operator",
      headers: ["Operator", "Stages completed", "Active hours", "Panels", "Waste", "Defective", "Downtime min"],
      widths: [22, 17, 13, 9, 8, 10, 14],
      rows: report.operators.map((o) => [o.operator, o.stages, Math.round((o.minutes / 60) * 10) / 10, o.panels, o.waste, o.defects, o.downtime]),
    },
  ];
}

/** Board planned per material in cutting plans approved during the period. */
export async function materialUsage(from: Date, to: Date) {
  await connectDb();
  const versions = await CutlistVersion.find({ state: { $in: ["APPROVED", "SUPERSEDED"] }, approvedAt: { $gte: from, $lte: to } })
    .select("stockSheets plan.sheets.stockRef plan.sheets.length plan.sheets.width plan.sheets.usedArea")
    .lean();
  const rows = new Map<string, { material: string; sheets: number; area: number; used: number }>();
  for (const v of versions) {
    const label = new Map(v.stockSheets.map((s) => [s.ref, s.materialName ? `${s.materialName} ${s.thicknessMm} mm` : `${s.length}×${s.width} (no material)`]));
    for (const sheet of v.plan?.sheets ?? []) {
      const key = label.get(sheet.stockRef) ?? "Unknown";
      const r = rows.get(key) ?? { material: key, sheets: 0, area: 0, used: 0 };
      r.sheets += 1;
      r.area += sheet.length * sheet.width;
      r.used += sheet.usedArea;
      rows.set(key, r);
    }
  }
  return [...rows.values()].sort((a, b) => b.sheets - a.sheets);
}
