import "server-only";
import mongoose from "mongoose";
import type { JobStatus } from "@/lib/jobs";
import { connectDb } from "@/server/db/connect";
import { CutlistVersion } from "@/server/db/models/CutlistVersion";
import { Issue } from "@/server/db/models/Issue";
import { Job } from "@/server/db/models/Job";
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";
import { ProcessingSession } from "@/server/db/models/ProcessingSession";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { User } from "@/server/db/models/User";
import { capabilitiesOf, visibleFilter } from "@/server/services/production";

const DAY = 24 * 60 * 60 * 1000;

/** Every figure on the staff overview, counted from the database now. */
export async function staffDashboard(now = new Date()) {
  await connectDb();
  const since14 = new Date(now.getTime() - 13 * DAY);
  since14.setUTCHours(0, 0, 0, 0);
  const since30 = new Date(now.getTime() - 30 * DAY);

  const [statusRows, perDayRows, openIssues, completed30, unassigned, load, approved] = await Promise.all([
    Job.aggregate<{ _id: JobStatus; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Job.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since14 } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    ]),
    Issue.countDocuments({ status: "OPEN" }),
    // A completed job is not modified again, so updatedAt is its completion time.
    Job.countDocuments({ status: "COMPLETED", updatedAt: { $gte: since30 } }),
    ProductionTask.countDocuments({ status: { $in: ["QUEUED", "PAUSED"] }, assignedOperatorId: null }),
    ProductionTask.aggregate<{ _id: { op: string; stage: "CUTTING" | "CNC" | "EDGING" }; count: number }>([
      { $match: { status: { $in: ["BLOCKED", "QUEUED", "IN_PROGRESS", "PAUSED"] }, assignedOperatorId: { $ne: null } } },
      { $group: { _id: { op: "$assignedOperatorId", stage: "$stage" }, count: { $sum: 1 } } },
    ]),
    CutlistVersion.find({ state: "APPROVED", approvedAt: { $gte: new Date(now.getTime() - 90 * DAY) } })
      .select("stockSheets plan.sheets.stockRef")
      .lean(),
  ]);

  const byStatus = Object.fromEntries(statusRows.map((r) => [r._id, r.count])) as Partial<Record<JobStatus, number>>;
  const n = (s: JobStatus) => byStatus[s] ?? 0;

  // Fill every day, including days with no jobs.
  const perDayMap = new Map(perDayRows.map((r) => [r._id, r.count]));
  const jobsPerDay = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since14.getTime() + i * DAY);
    const key = d.toISOString().slice(0, 10);
    return { day: key, label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }), jobs: perDayMap.get(key) ?? 0 };
  });

  const operators = await User.find({ _id: { $in: [...new Set(load.map((l) => l._id.op))] } }).select("name").lean();
  const opName = new Map(operators.map((o) => [o._id.toString(), o.name]));
  const loadMap = new Map<string, { id: string; name: string; cutting: number; cnc: number; edging: number }>();
  for (const l of load) {
    const id = l._id.op.toString();
    const row = loadMap.get(id) ?? { id, name: opName.get(id) ?? "Unknown", cutting: 0, cnc: 0, edging: 0 };
    if (l._id.stage === "CUTTING") row.cutting += l.count;
    else if (l._id.stage === "CNC") row.cnc += l.count;
    else row.edging += l.count;
    loadMap.set(id, row);
  }
  const workload = [...loadMap.values()].sort((a, b) => b.cutting + b.cnc + b.edging - (a.cutting + a.cnc + a.edging));

  const sheetsByMaterial = new Map<string, number>();
  for (const v of approved) {
    const label = new Map(v.stockSheets.map((s) => [s.ref, s.materialName ? `${s.materialName} ${s.thicknessMm} mm` : `${s.length}×${s.width} (no material)`]));
    for (const sheet of v.plan?.sheets ?? []) {
      const key = label.get(sheet.stockRef) ?? "Unknown";
      sheetsByMaterial.set(key, (sheetsByMaterial.get(key) ?? 0) + 1);
    }
  }

  return {
    kpis: {
      active: statusRows.filter((r) => r._id !== "COMPLETED" && r._id !== "CANCELLED").reduce((a, r) => a + r.count, 0),
      inProduction: n("CUTTING_IN_PROGRESS") + n("CNC_IN_PROGRESS") + n("EDGING_IN_PROGRESS"),
      waitingInQueues: n("QUEUED_FOR_CUTTING") + n("QUEUED_FOR_CNC") + n("QUEUED_FOR_EDGING"),
      unassigned,
      openIssues,
      completed30: completed30,
    },
    byStatus,
    jobsPerDay,
    workload,
    sheetsByMaterial: [...sheetsByMaterial].map(([material, sheets]) => ({ material, sheets })).sort((a, b) => b.sheets - a.sheets),
  };
}

/** An operator's own figures: what is waiting, and what they did recently. */
export async function operatorDashboard(operatorId: string, now = new Date()) {
  await connectDb();
  const me = new mongoose.Types.ObjectId(operatorId);
  const since14 = new Date(now.getTime() - 13 * DAY);
  since14.setUTCHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 7 * DAY);

  const [waiting, done, sessions] = await Promise.all([
    ProductionTask.countDocuments(visibleFilter(me, await capabilitiesOf(me))),
    ProductionTask.find({ completedBy: me, completedAt: { $gte: since14 } }).select("completedAt").lean(),
    ProcessingSession.find({ operatorId: me, startedAt: { $gte: weekAgo } }).select("startedAt endedAt").lean(),
  ]);

  const perDay = new Map<string, number>();
  for (const t of done) {
    const key = t.completedAt!.toISOString().slice(0, 10);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const completedPerDay = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since14.getTime() + i * DAY);
    const key = d.toISOString().slice(0, 10);
    return { day: key, label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }), jobs: perDay.get(key) ?? 0 };
  });
  const workedMs = sessions.reduce((ms, s) => ms + ((s.endedAt ?? now).getTime() - s.startedAt.getTime()), 0);

  return {
    waiting,
    completedThisWeek: done.filter((t) => t.completedAt! >= weekAgo).length,
    hoursThisWeek: Math.round((workedMs / 3_600_000) * 10) / 10,
    completedPerDay,
  };
}

/** The lists behind "Needs attention", the queue snapshots and recent activity. */
export async function commandCentre() {
  await connectDb();
  const [unassigned, issues, awaitingMaterial, events, cutting, cnc, edging] = await Promise.all([
    ProductionTask.find({ status: { $in: ["QUEUED", "PAUSED"] }, assignedOperatorId: null })
      .sort({ queueSeq: 1, createdAt: 1 })
      .limit(6)
      .select("workNumber stage status")
      .lean(),
    Issue.find({ status: "OPEN" }).sort({ createdAt: -1 }).limit(6).select("workNumber category reporterRole createdAt").lean(),
    Job.find({ status: "AWAITING_MATERIAL" }).sort({ updatedAt: 1 }).limit(6).select("workNumber title updatedAt").lean(),
    JobStatusEvent.find().sort({ at: -1 }).limit(12).lean(),
    ProductionTask.find({ stage: "CUTTING", status: { $in: ["QUEUED", "IN_PROGRESS", "PAUSED"] } }).sort({ queueSeq: 1 }).limit(6).lean(),
    ProductionTask.find({ stage: "CNC", status: { $in: ["QUEUED", "IN_PROGRESS", "PAUSED"] } }).sort({ queueSeq: 1 }).limit(6).lean(),
    ProductionTask.find({ stage: "EDGING", status: { $in: ["QUEUED", "IN_PROGRESS", "PAUSED"] } }).sort({ queueSeq: 1 }).limit(6).lean(),
  ]);
  const [jobs, people] = await Promise.all([
    Job.find({ _id: { $in: events.map((e) => e.jobId) } }).select("workNumber").lean(),
    User.find({ _id: { $in: [...events.map((e) => e.actorId), ...cutting.map((t) => t.assignedOperatorId), ...cnc.map((t) => t.assignedOperatorId), ...edging.map((t) => t.assignedOperatorId)].filter(Boolean) } })
      .select("name")
      .lean(),
  ]);
  const workNumber = new Map(jobs.map((j) => [j._id.toString(), j.workNumber]));
  const name = new Map(people.map((p) => [p._id.toString(), p.name]));
  const snapshot = (tasks: typeof cutting) =>
    tasks.map((t) => ({
      id: t._id.toString(),
      workNumber: t.workNumber,
      queueSeq: t.queueSeq,
      status: t.status,
      operator: t.assignedOperatorId ? name.get(t.assignedOperatorId.toString()) : undefined,
    }));

  return {
    unassigned: unassigned.map((t) => ({ id: t._id.toString(), workNumber: t.workNumber, stage: t.stage, queued: t.status !== "BLOCKED" })),
    issues: issues.map((i) => ({ id: i._id.toString(), workNumber: i.workNumber, category: i.category, reporterRole: i.reporterRole, at: i.createdAt })),
    awaitingMaterial: awaitingMaterial.map((j) => ({ workNumber: j.workNumber, title: j.title, since: j.updatedAt })),
    cutting: snapshot(cutting),
    cnc: snapshot(cnc),
    edging: snapshot(edging),
    activity: events.map((e) => ({
      id: e._id.toString(),
      at: e.at,
      type: e.type,
      note: e.note,
      workNumber: workNumber.get(e.jobId.toString()),
      actor: e.actorId ? name.get(e.actorId.toString()) : undefined,
    })),
  };
}

/** Problems this operator reported, newest first. */
export async function operatorIssues(operatorId: string) {
  await connectDb();
  return Issue.find({ reportedBy: operatorId }).sort({ createdAt: -1 }).limit(5).lean();
}
