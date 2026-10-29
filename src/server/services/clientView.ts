import "server-only";
import { estimateMinutes } from "@/lib/cutlist";
import type { Stage, TaskStatus } from "@/lib/production";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { Job } from "@/server/db/models/Job";
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { User } from "@/server/db/models/User";
import { estimateAssumptions } from "@/lib/settings";
import { getCutlists } from "@/server/services/cutlists";
import { getSettings } from "@/server/services/settings";

export type StepState = "done" | "current" | "upcoming" | "na";
export type Step = { key: string; label: string; state: StepState; at?: Date; detail?: string };

/**
 * One client's view of one of their jobs, built only from recorded events
 * and tasks. Returns null for a job that is not theirs.
 */
export async function clientJobView(clientUserId: string, workNumber: string) {
  await connectDb();
  const job = await Job.findOne({ workNumber }).lean();
  if (!job) return null;
  const owns = await ClientProfile.exists({ _id: job.clientId, userId: clientUserId });
  if (!owns) return null;

  const [events, tasks, cutlists] = await Promise.all([
    JobStatusEvent.find({ jobId: job._id, clientVisible: true }).sort({ at: 1 }).lean(),
    ProductionTask.find({ jobId: job._id }).lean(),
    getCutlists(job._id),
  ]);
  const operators = await User.find({ _id: { $in: tasks.map((t) => t.assignedOperatorId).filter(Boolean) } }).select("name").lean();
  const opName = new Map(operators.map((o) => [o._id.toString(), o.name]));
  const first = (type: string) => events.find((e) => e.type === type)?.at;
  const last = (type: string) => [...events].reverse().find((e) => e.type === type)?.at;
  const task = (stage: Stage) => tasks.find((t) => t.stage === stage);
  const cut = task("CUTTING");
  const edge = task("EDGING");
  const edging = Boolean(job.operations?.edging);

  // Jobs ahead of this one in the cutting queue, for a sense of waiting time.
  const ahead =
    cut?.status === "QUEUED" && cut.queueSeq != null
      ? await ProductionTask.countDocuments({ stage: "CUTTING", status: { $in: ["QUEUED", "IN_PROGRESS", "PAUSED"] }, queueSeq: { $lt: cut.queueSeq } })
      : undefined;

  const stageDetail = (t: typeof cut, word: string) => {
    if (!t) return undefined;
    const name = t.assignedOperatorId ? opName.get(t.assignedOperatorId.toString()) : undefined;
    const parts = [name ? `${word} operator: ${name}` : `${word} operator: the first free operator, when the work starts`];
    if ((t.status as TaskStatus) === "PAUSED") parts.push("paused for now");
    return parts.join(" · ");
  };

  const raw: Array<Omit<Step, "state"> & { done: boolean; na?: boolean }> = [
    { key: "registered", label: "Order registered", done: true, at: first("JOB_CREATED") ?? job.createdAt },
    { key: "approved", label: "Cutlist approved", done: Boolean(cutlists.approved), at: last("CUTLIST_APPROVED") },
    { key: "materials", label: "Materials ready", done: Boolean(job.materialConfirmedAt), at: job.materialConfirmedAt ?? undefined },
    {
      key: "cut-start",
      label: "Cutting started",
      done: Boolean(cut?.firstStartedAt),
      at: cut?.firstStartedAt ?? undefined,
      detail: [stageDetail(cut, "Cutting"), ahead !== undefined ? `${ahead} job${ahead === 1 ? "" : "s"} ahead in the cutting queue` : undefined].filter(Boolean).join(" · "),
    },
    { key: "cut-done", label: "Cutting completed", done: cut?.status === "COMPLETED", at: cut?.completedAt ?? undefined, detail: stageDetail(cut, "Cutting") },
    { key: "edge-start", label: "Edging started", done: Boolean(edge?.firstStartedAt), at: edge?.firstStartedAt ?? undefined, detail: edging ? stageDetail(edge, "Edging") : undefined, na: !edging },
    { key: "edge-done", label: "Edging completed", done: edge?.status === "COMPLETED", at: edge?.completedAt ?? undefined, detail: edging ? stageDetail(edge, "Edging") : undefined, na: !edging },
    { key: "completed", label: "Ready for collection", done: job.status === "COMPLETED", at: first("JOB_COMPLETED") },
  ];
  let currentSet = false;
  const steps: Step[] = raw.map(({ done, na, ...s }) => {
    if (na) return { ...s, state: "na", detail: "Not applicable: no edging on this job" };
    if (done) return { ...s, state: "done" };
    if (!currentSet && job.status !== "CANCELLED") {
      currentSet = true;
      return { ...s, state: "current" };
    }
    return { ...s, state: "upcoming" };
  });

  const plan = cutlists.approved?.plan;
  const estimate = plan && cutlists.approved ? estimateMinutes(plan.totals, cutlists.approved, job.operations ?? { cutting: true, edging: false }, estimateAssumptions(await getSettings())) : null;

  return { job, steps, events, estimate };
}
