import "server-only";
import mongoose, { type ClientSession, type Types } from "mongoose";
import { z } from "zod";
import {
  clientPaymentSchema,
  formatMoney,
  operatorPaymentSchema,
  parseAmount,
  type ClientCoverage,
  type ClientPaymentStatus,
  type PaymentMethod,
} from "@/lib/payments";
import { STAGE_LABELS, type Stage } from "@/lib/production";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { Job } from "@/server/db/models/Job";
import { Payment } from "@/server/db/models/Payment";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { User } from "@/server/db/models/User";
import { audit } from "@/server/services/audit";
import { getSettings } from "@/server/services/settings";
import { ServiceError, type Actor } from "@/server/services/users";
import { recordJobEvent } from "@/server/workflow/transitions";

function assertStaff(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") throw new ServiceError("FORBIDDEN", "Only staff record payments.");
}

function parse<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new ServiceError("INVALID", r.error.issues[0]?.message ?? "Check the payment details.");
  return r.data;
}

/** The stored fields common to every entry. Noon UTC keeps the chosen day in any time zone. */
function entryFields(input: { amount?: string; method?: PaymentMethod | ""; note?: string; paidOn?: string }) {
  return {
    amountMinor: parseAmount(input.amount ?? ""),
    method: input.method || undefined,
    note: input.note || undefined,
    paidAt: input.paidOn ? new Date(`${input.paidOn}T12:00:00Z`) : new Date(),
  };
}

async function money(minor: number | undefined) {
  return minor ? ` · ${formatMoney(minor, (await getSettings()).currency || null)}` : "";
}

/** Recomputes a job's payment summary from its live client entries. */
async function refreshJobPayment(jobId: Types.ObjectId, session: ClientSession): Promise<ClientPaymentStatus> {
  const live = await Payment.find({ jobId, kind: "CLIENT", live: true }).select("coverage").session(session).lean();
  const status: ClientPaymentStatus = live.some((p) => p.coverage === "FULL") ? "FULL" : live.length ? "PART" : "UNPAID";
  await Job.updateOne({ _id: jobId }, { $set: { clientPayment: status } }, { session });
  return status;
}

/**
 * Records a client payment inside an existing transaction (job creation uses
 * this). The job's summary becomes "paid in full" once any full payment is
 * recorded, otherwise "part paid".
 */
export async function addClientPayment(
  actor: Actor,
  job: { _id: Types.ObjectId; workNumber: string; clientId: Types.ObjectId },
  input: { coverage: ClientCoverage; amount?: string; method?: PaymentMethod | ""; note?: string; paidOn?: string },
  session: ClientSession,
) {
  const fields = entryFields(input);
  const [entry] = await Payment.create(
    [{ kind: "CLIENT", jobId: job._id, workNumber: job.workNumber, clientId: job.clientId, coverage: input.coverage, ...fields, recordedBy: actor.id, live: true }],
    { session },
  );
  await refreshJobPayment(job._id, session);
  await recordJobEvent(
    job._id,
    { type: "PAYMENT_RECORDED", actorId: actor.id, note: `${input.coverage === "FULL" ? "Full" : "Part"} payment from the client${await money(fields.amountMinor)}`, clientVisible: false },
    session,
  );
  return entry;
}

export async function recordClientPayment(actor: Actor, workNumber: string, raw: unknown) {
  assertStaff(actor);
  const input = parse(clientPaymentSchema, raw);
  await connectDb();
  const job = await Job.findOne({ workNumber }).select("_id workNumber clientId").lean();
  if (!job) throw new ServiceError("NOT_FOUND", "Job not found.");
  const entry = await mongoose.connection.transaction((session) => addClientPayment(actor, job, input, session));
  await audit({ actorId: actor.id, action: "payment.client_recorded", targetType: "Job", targetId: job._id, meta: { workNumber, coverage: input.coverage, amountMinor: entry.amountMinor } });
  return entry;
}

/** Records that the operator who completed a stage has been paid for it. Once per stage. */
export async function recordOperatorPayment(actor: Actor, taskId: string, raw: unknown) {
  assertStaff(actor);
  const input = parse(operatorPaymentSchema, raw);
  if (!mongoose.isValidObjectId(taskId)) throw new ServiceError("NOT_FOUND", "Stage not found.");
  await connectDb();
  const task = await ProductionTask.findById(taskId).lean();
  if (!task) throw new ServiceError("NOT_FOUND", "Stage not found.");
  if (task.status !== "COMPLETED" || !task.completedBy) throw new ServiceError("CONFLICT", "Operators are paid for completed stages only.");
  const [job, operator] = await Promise.all([Job.findById(task.jobId).select("clientId").lean(), User.findById(task.completedBy).select("name").lean()]);
  if (!job) throw new ServiceError("NOT_FOUND", "Job not found.");
  const fields = entryFields(input);

  try {
    await mongoose.connection.transaction(async (session) => {
      await Payment.create(
        [{ kind: "OPERATOR", jobId: task.jobId, workNumber: task.workNumber, clientId: job.clientId, operatorId: task.completedBy, taskId: task._id, stage: task.stage, ...fields, recordedBy: actor.id, live: true }],
        { session },
      );
      await recordJobEvent(
        task.jobId,
        { type: "OPERATOR_PAID", actorId: actor.id, note: `${operator?.name ?? "Operator"} paid for ${STAGE_LABELS[task.stage as Stage].toLowerCase()}${await money(fields.amountMinor)}`, clientVisible: false },
        session,
      );
    });
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) throw new ServiceError("CONFLICT", "This operator's pay for this stage is already recorded.");
    throw error;
  }
  await audit({ actorId: actor.id, action: "payment.operator_recorded", targetType: "ProductionTask", targetId: task._id, meta: { workNumber: task.workNumber, operatorId: task.completedBy, amountMinor: fields.amountMinor } });
}

const reasonSchema = z.string().trim().min(3, "Say why this entry is wrong.").max(500);

/** Voids a mistaken entry. It stays on record, struck through, with who voided it and why. */
export async function voidPayment(actor: Actor, paymentId: string, reason: string) {
  assertStaff(actor);
  const why = parse(reasonSchema, reason);
  if (!mongoose.isValidObjectId(paymentId)) throw new ServiceError("NOT_FOUND", "Payment not found.");
  await connectDb();
  const entry = await mongoose.connection.transaction(async (session) => {
    const p = await Payment.findOneAndUpdate(
      { _id: paymentId, live: true },
      { $unset: { live: 1 }, $set: { voidedAt: new Date(), voidedBy: actor.id, voidReason: why } },
      { session, returnDocument: "after" },
    ).lean();
    if (!p) throw new ServiceError("CONFLICT", "This entry was already voided or does not exist.");
    if (p.kind === "CLIENT") await refreshJobPayment(p.jobId, session);
    await recordJobEvent(p.jobId, { type: "PAYMENT_VOIDED", actorId: actor.id, note: `${p.kind === "CLIENT" ? "Client payment" : "Operator pay"} entry voided: ${why}`, clientVisible: false }, session);
    return p;
  });
  await audit({ actorId: actor.id, action: "payment.voided", targetType: "Payment", targetId: entry._id, meta: { workNumber: entry.workNumber, reason: why } });
}

// ── Reading ─────────────────────────────────────────────────────────────────

export type LedgerRow = {
  id: string;
  kind: "CLIENT" | "OPERATOR";
  workNumber: string;
  coverage?: ClientCoverage;
  stage?: Stage;
  clientId: string;
  clientName: string;
  operatorId?: string;
  operatorName?: string;
  amountMinor?: number;
  method?: PaymentMethod;
  note?: string;
  paidAt: Date;
  recordedBy: string;
  voided?: { at: Date; by: string; reason: string };
};

async function names(userIds: Array<Types.ObjectId | null | undefined>, clientIds: Types.ObjectId[]) {
  const profiles = await ClientProfile.find({ _id: { $in: clientIds } }).select("userId businessName clientNumber").lean();
  const people = await User.find({ _id: { $in: [...userIds.filter(Boolean), ...profiles.map((p) => p.userId)] } }).select("name").lean();
  const user = new Map(people.map((u) => [u._id.toString(), u.name]));
  const client = new Map(profiles.map((p) => [p._id.toString(), p.businessName || user.get(p.userId.toString()) || p.clientNumber]));
  return { user: (id?: Types.ObjectId | null) => (id ? (user.get(id.toString()) ?? "Unknown") : ""), client: (id: Types.ObjectId) => client.get(id.toString()) ?? "Unknown client" };
}

async function toLedger(entries: Awaited<ReturnType<typeof loadEntries>>): Promise<LedgerRow[]> {
  const n = await names(
    entries.flatMap((e) => [e.operatorId, e.recordedBy, e.voidedBy]),
    entries.map((e) => e.clientId),
  );
  return entries.map((e) => ({
    id: e._id.toString(),
    kind: e.kind,
    workNumber: e.workNumber,
    coverage: e.coverage ?? undefined,
    stage: (e.stage as Stage) ?? undefined,
    clientId: e.clientId.toString(),
    clientName: n.client(e.clientId),
    operatorId: e.operatorId?.toString(),
    operatorName: e.operatorId ? n.user(e.operatorId) : undefined,
    amountMinor: e.amountMinor ?? undefined,
    method: (e.method as PaymentMethod) ?? undefined,
    note: e.note ?? undefined,
    paidAt: e.paidAt,
    recordedBy: n.user(e.recordedBy),
    voided: e.voidedAt ? { at: e.voidedAt, by: n.user(e.voidedBy), reason: e.voidReason ?? "" } : undefined,
  }));
}

function loadEntries(filter: Record<string, unknown>, limit = 300) {
  return Payment.find(filter).sort({ paidAt: -1, createdAt: -1 }).limit(limit).lean();
}

/** Everything the job page's payment section shows. */
export async function jobPayments(jobId: Types.ObjectId) {
  await connectDb();
  const [job, entries, tasks] = await Promise.all([
    Job.findById(jobId).select("clientPayment status").lean(),
    loadEntries({ jobId }),
    ProductionTask.find({ jobId, status: "COMPLETED" }).sort({ completedAt: 1 }).select("stage completedBy completedAt").lean(),
  ]);
  const ledger = await toLedger(entries);
  const people = await User.find({ _id: { $in: tasks.map((t) => t.completedBy) } }).select("name").lean();
  const name = new Map(people.map((u) => [u._id.toString(), u.name]));
  const row = new Map(ledger.map((r) => [r.id, r]));
  const liveForTask = new Map(entries.filter((e) => e.kind === "OPERATOR" && e.live).map((e) => [e.taskId!.toString(), e._id.toString()]));
  const stages = tasks.map((t) => ({
    taskId: t._id.toString(),
    stage: t.stage as Stage,
    operatorId: t.completedBy?.toString(),
    operatorName: t.completedBy ? (name.get(t.completedBy.toString()) ?? "Unknown") : "—",
    completedAt: t.completedAt,
    payment: row.get(liveForTask.get(t._id.toString()) ?? ""),
  }));
  return {
    status: (job?.clientPayment ?? "UNPAID") as ClientPaymentStatus,
    jobStatus: job?.status,
    clientEntries: ledger.filter((e) => e.kind === "CLIENT"),
    stages,
    ledger,
  };
}

export type PaymentFilter = { clientId?: string; operatorId?: string };

/**
 * The payments page: every job's client payment status, every completed
 * stage's operator pay, and the ledger, optionally narrowed to one client or
 * one operator.
 */
export async function paymentsOverview(filter: PaymentFilter = {}) {
  await connectDb();
  const clientId = filter.clientId && mongoose.isValidObjectId(filter.clientId) ? new mongoose.Types.ObjectId(filter.clientId) : undefined;
  const operatorId = filter.operatorId && mongoose.isValidObjectId(filter.operatorId) ? new mongoose.Types.ObjectId(filter.operatorId) : undefined;

  // An operator filter narrows everything to the jobs they completed a stage on.
  const operatorTasks = operatorId ? await ProductionTask.find({ completedBy: operatorId, status: "COMPLETED" }).select("jobId").lean() : [];
  const jobScope: Record<string, unknown> = { status: { $ne: "CANCELLED" } };
  if (clientId) jobScope.clientId = clientId;
  if (operatorId) jobScope._id = { $in: operatorTasks.map((t) => t.jobId) };

  const jobs = await Job.find(jobScope).sort({ createdAt: -1 }).limit(300).select("workNumber title status clientId clientPayment createdAt").lean();
  const jobIds = jobs.map((j) => j._id);

  const taskScope: Record<string, unknown> = { status: "COMPLETED", jobId: { $in: jobIds } };
  if (operatorId) taskScope.completedBy = operatorId;
  const [tasks, entries, sums] = await Promise.all([
    ProductionTask.find(taskScope).sort({ completedAt: -1 }).limit(300).select("jobId workNumber stage completedBy completedAt").lean(),
    loadEntries({ jobId: { $in: jobIds }, ...(operatorId ? { $or: [{ kind: "CLIENT" }, { operatorId }] } : {}) }),
    Payment.aggregate<{ _id: { jobId: Types.ObjectId; kind: string }; total: number; count: number }>([
      { $match: { jobId: { $in: jobIds }, live: true } },
      { $group: { _id: { jobId: "$jobId", kind: "$kind" }, total: { $sum: { $ifNull: ["$amountMinor", 0] } }, count: { $sum: 1 } } },
    ]),
  ]);
  const paidTasks = new Set(
    (await Payment.find({ taskId: { $in: tasks.map((t) => t._id) }, kind: "OPERATOR", live: true }).select("taskId").lean()).map((p) => p.taskId!.toString()),
  );
  const ledger = await toLedger(entries);
  const n = await names(tasks.map((t) => t.completedBy), jobs.map((j) => j.clientId));
  const sum = (jobId: Types.ObjectId, kind: string) => sums.find((s) => s._id.jobId.equals(jobId) && s._id.kind === kind);
  const opPay = new Map(ledger.filter((e) => e.kind === "OPERATOR" && !e.voided).map((e) => [e.id, e]));
  const entryByTask = new Map(entries.filter((e) => e.kind === "OPERATOR" && e.live).map((e) => [e.taskId!.toString(), opPay.get(e._id.toString())]));

  const jobRows = jobs.map((j) => ({
    workNumber: j.workNumber,
    title: j.title ?? undefined,
    status: j.status,
    clientId: j.clientId.toString(),
    clientName: n.client(j.clientId),
    payment: (j.clientPayment ?? "UNPAID") as ClientPaymentStatus,
    receivedMinor: sum(j._id, "CLIENT")?.total ?? 0,
    entries: sum(j._id, "CLIENT")?.count ?? 0,
    operatorPaidMinor: sum(j._id, "OPERATOR")?.total ?? 0,
  }));
  const jobClient = new Map(jobs.map((j) => [j._id.toString(), j.clientId]));
  const stageRows = tasks.map((t) => ({
    taskId: t._id.toString(),
    workNumber: t.workNumber,
    clientId: jobClient.get(t.jobId.toString())!.toString(),
    clientName: n.client(jobClient.get(t.jobId.toString())!),
    stage: t.stage as Stage,
    operatorId: t.completedBy?.toString(),
    operatorName: n.user(t.completedBy),
    completedAt: t.completedAt,
    paid: paidTasks.has(t._id.toString()),
    payment: entryByTask.get(t._id.toString()),
  }));

  const live = ledger.filter((e) => !e.voided);
  return {
    totals: {
      receivedMinor: live.filter((e) => e.kind === "CLIENT").reduce((a, e) => a + (e.amountMinor ?? 0), 0),
      paidOutMinor: live.filter((e) => e.kind === "OPERATOR").reduce((a, e) => a + (e.amountMinor ?? 0), 0),
      unpaidJobs: jobRows.filter((j) => j.payment === "UNPAID").length,
      partJobs: jobRows.filter((j) => j.payment === "PART").length,
      fullJobs: jobRows.filter((j) => j.payment === "FULL").length,
      stagesAwaitingPay: stageRows.filter((s) => !s.paid).length,
    },
    jobs: jobRows,
    stages: stageRows,
    ledger,
  };
}
