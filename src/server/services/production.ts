import "server-only";
import mongoose, { type ClientSession, type QueryFilter, type Types } from "mongoose";
import { z } from "zod";
import { completionSchema, eligibility, type CompletionInput, type QueueItem, type Stage } from "@/lib/production";

export type { CompletionInput };
import { connectDb } from "@/server/db/connect";
import { nextSequence } from "@/server/db/models/Counter";
import { Job } from "@/server/db/models/Job";
import { Photo } from "@/server/db/models/Photo";
import { ProcessingSession } from "@/server/db/models/ProcessingSession";
import { ProductionTask, type ProductionTaskDoc } from "@/server/db/models/ProductionTask";
import { User } from "@/server/db/models/User";
import { audit } from "@/server/services/audit";
import { notify, notifyStageOperators } from "@/server/services/notifications";
import { ServiceError, type Actor } from "@/server/services/users";
import { recordJobEvent, transitionJob } from "@/server/workflow/transitions";

type Operator = { id: string; role: string };

const STAGE_WORD: Record<Stage, string> = { CUTTING: "Cutting", EDGING: "Edging" };

function oid(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ServiceError("NOT_FOUND", "Task not found.");
  return new mongoose.Types.ObjectId(id);
}

async function loadTask(taskId: string, session?: ClientSession) {
  const task = await ProductionTask.findById(oid(taskId)).session(session ?? null);
  if (!task) throw new ServiceError("NOT_FOUND", "Task not found.");
  return task;
}

/** The operator must be active and hold the stage's capability, checked fresh. */
async function assertOperatorCan(operatorId: string | Types.ObjectId, stage: Stage, session?: ClientSession) {
  const op = await User.findById(operatorId).select("role status capabilities name").session(session ?? null).lean();
  if (!op || op.role !== "OPERATOR" || op.status !== "ACTIVE") throw new ServiceError("FORBIDDEN", "That operator is not active.");
  if (!op.capabilities.includes(stage)) throw new ServiceError("FORBIDDEN", `That operator is not set up for ${STAGE_WORD[stage].toLowerCase()}.`);
  return op;
}

// ── Who sees what ───────────────────────────────────────────────────────────
//
// Nobody assigns work. Every open stage is offered to every operator who can
// do it; the first to press Start takes it, and from then on it is theirs
// alone (paused included) until it is finished or staff release it.

const OPEN_STATUSES = ["BLOCKED", "QUEUED", "IN_PROGRESS", "PAUSED"] as const;

/** Open work in the operator's stages that nobody has taken, plus their own. */
export function visibleFilter(operatorId: Types.ObjectId, capabilities: readonly string[]): QueryFilter<ProductionTaskDoc> {
  return {
    status: { $in: [...OPEN_STATUSES] },
    $or: [{ assignedOperatorId: operatorId }, { assignedOperatorId: null, stage: { $in: capabilities as Stage[] } }],
  };
}

/** The same rule for one task already loaded (completed work stays visible to whoever did it). */
export function operatorCanSee(task: { stage: string; status: string; assignedOperatorId?: Types.ObjectId | null; completedBy?: Types.ObjectId | null }, operator: { id: string; capabilities: readonly string[] }) {
  if (task.assignedOperatorId?.toString() === operator.id || task.completedBy?.toString() === operator.id) return true;
  return !task.assignedOperatorId && (OPEN_STATUSES as readonly string[]).includes(task.status) && operator.capabilities.includes(task.stage);
}

/** An operator's capabilities, read fresh from the database. */
export async function capabilitiesOf(operatorId: string | Types.ObjectId, session?: ClientSession): Promise<string[]> {
  const op = await User.findById(operatorId).select("role status capabilities").session(session ?? null).lean();
  return op && op.role === "OPERATOR" && op.status === "ACTIVE" ? [...op.capabilities] : [];
}

/** The tasks the queue rule considers for this operator. */
async function visibleQueueItems(operatorId: Types.ObjectId, capabilities: readonly string[], session?: ClientSession): Promise<QueueItem[]> {
  const tasks = await ProductionTask.find(visibleFilter(operatorId, capabilities))
    .select("workNumber status queueSeq stage")
    .session(session ?? null)
    .lean();
  return tasks.map((t) => ({ id: t._id.toString(), workNumber: t.workNumber, status: t.status, queueSeq: t.queueSeq ?? null, stage: t.stage }));
}

// ── Release (staff) ─────────────────────────────────────────────────────────

/**
 * Hands a taken stage back to the shared queue, for when its operator cannot
 * carry on. Work in progress is paused first, so the time spent stays
 * recorded; the stage keeps its place in the queue.
 */
export async function releaseTask(actor: Actor, taskId: string) {
  if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") throw new ServiceError("FORBIDDEN", "Only staff can release work.");
  await connectDb();

  await mongoose.connection.transaction(async (session) => {
    const task = await loadTask(taskId, session);
    if (task.status === "COMPLETED" || task.status === "CANCELLED") throw new ServiceError("CONFLICT", "This work is finished.");
    if (!task.assignedOperatorId) throw new ServiceError("CONFLICT", "Nobody has taken this work.");
    const previous = await User.findById(task.assignedOperatorId).select("name").session(session).lean();

    if (task.status === "IN_PROGRESS") {
      await ProcessingSession.updateOne({ taskId: task._id, endedAt: null }, { $set: { endedAt: new Date(), endReason: "REASSIGN" } }, { session });
    }
    const r = await ProductionTask.updateOne(
      { _id: task._id, status: task.status, assignedOperatorId: task.assignedOperatorId },
      { $set: task.status === "IN_PROGRESS" ? { status: "PAUSED" } : {}, $unset: { assignedOperatorId: 1, activeOperatorId: 1 } },
      { session },
    );
    if (r.modifiedCount !== 1) throw new ServiceError("CONFLICT", "The task changed. Reload and try again.");

    const word = STAGE_WORD[task.stage as Stage];
    await recordJobEvent(
      task.jobId,
      { type: "TASK_RELEASED", actorId: actor.id, note: `${word} released from ${previous?.name ?? "its operator"}${task.status === "IN_PROGRESS" ? " (work in progress paused)" : ""}`, clientVisible: false },
      session,
    );
    await notify([task.assignedOperatorId], { title: `${word} of ${task.workNumber} was handed back to the queue`, href: "/operator/queue" }, session);
    if (task.status !== "BLOCKED") await notifyStageOperators(task.stage as Stage, task.workNumber, session, task.assignedOperatorId);
  });
  await audit({ actorId: actor.id, action: "task.released", targetType: "ProductionTask", targetId: taskId });
}

// ── Operator actions ────────────────────────────────────────────────────────

/**
 * Starts (or resumes) a task, taking it if nobody has. Server-side checks,
 * inside one transaction: the operator is active and qualified, nobody else
 * has taken it, it is the oldest ready work in that queue, and they have
 * nothing else in progress. The update is conditional on nobody having taken
 * it, so two operators pressing Start together cannot both get it; the
 * database also refuses a second active task for one operator.
 */
export async function startTask(operator: Operator, taskId: string) {
  if (operator.role !== "OPERATOR") throw new ServiceError("FORBIDDEN", "Only operators record production work.");
  await connectDb();
  const me = oid(operator.id);

  try {
    await mongoose.connection.transaction(async (session) => {
      const task = await loadTask(taskId, session);
      if (task.assignedOperatorId && !task.assignedOperatorId.equals(me)) throw new ServiceError("CONFLICT", "Another operator has already taken this work.");
      const op = await assertOperatorCan(me, task.stage as Stage, session);

      const rule = eligibility(await visibleQueueItems(me, op.capabilities, session)).get(task._id.toString());
      if (!rule?.canStart) throw new ServiceError("CONFLICT", rule?.reason ?? "This work cannot be started now.");

      const resuming = task.status === "PAUSED";
      const now = new Date();
      const r = await ProductionTask.updateOne(
        { _id: task._id, status: task.status, $or: [{ assignedOperatorId: null }, { assignedOperatorId: me }] },
        { $set: { status: "IN_PROGRESS", assignedOperatorId: me, activeOperatorId: me, ...(task.firstStartedAt ? {} : { firstStartedAt: now }) } },
        { session },
      );
      if (r.modifiedCount !== 1) throw new ServiceError("CONFLICT", "Another operator took this work first. Reload to see what is next.");
      await ProcessingSession.create([{ taskId: task._id, jobId: task.jobId, operatorId: me, startedAt: now }], { session });

      const word = STAGE_WORD[task.stage as Stage];
      const event = { type: `${task.stage}_${resuming ? "RESUMED" : "STARTED"}`, actorId: operator.id, note: `${word} ${resuming ? "resumed" : "started"}` };
      if (!resuming && !task.firstStartedAt) {
        const [from, to] = task.stage === "CUTTING" ? (["QUEUED_FOR_CUTTING", "CUTTING_IN_PROGRESS"] as const) : (["QUEUED_FOR_EDGING", "EDGING_IN_PROGRESS"] as const);
        await transitionJob(task.jobId, from, to, event, session);
      } else {
        await recordJobEvent(task.jobId, event, session);
      }
    });
  } catch (error) {
    // The unique index on activeOperatorId: another task started at the same moment.
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
      throw new ServiceError("CONFLICT", "You already have work in progress.");
    }
    throw error;
  }
}

const pauseSchema = z.string().trim().min(3, "Say why the work is stopping.").max(500);

/** Stops work without completing it. Never counts as completion. */
export async function pauseTask(operator: Operator, taskId: string, reason: string) {
  if (operator.role !== "OPERATOR") throw new ServiceError("FORBIDDEN", "Only operators record production work.");
  const why = pauseSchema.safeParse(reason);
  if (!why.success) throw new ServiceError("INVALID", why.error.issues[0].message);
  await connectDb();
  const me = oid(operator.id);

  await mongoose.connection.transaction(async (session) => {
    const task = await loadTask(taskId, session);
    const r = await ProductionTask.updateOne(
      { _id: task._id, status: "IN_PROGRESS", activeOperatorId: me },
      { $set: { status: "PAUSED" }, $unset: { activeOperatorId: 1 } },
      { session },
    );
    if (r.modifiedCount !== 1) throw new ServiceError("CONFLICT", "This work is not in progress under your name.");
    await ProcessingSession.updateOne({ taskId: task._id, endedAt: null }, { $set: { endedAt: new Date(), endReason: "PAUSE", note: why.data } }, { session });
    await recordJobEvent(task.jobId, { type: `${task.stage}_PAUSED`, actorId: operator.id, note: `${STAGE_WORD[task.stage as Stage]} paused`, reason: why.data }, session);
  });
}

/**
 * Completes a stage after an explicit confirmation. Completing cutting
 * releases edging (if required) into the edging queue; the last stage
 * completes the job.
 */
export async function completeTask(operator: Operator, taskId: string, input: CompletionInput) {
  if (operator.role !== "OPERATOR") throw new ServiceError("FORBIDDEN", "Only operators record production work.");
  const parsed = completionSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("INVALID", parsed.error.issues[0]?.message ?? "Check the figures.");
  const results = parsed.data;
  await connectDb();
  const me = oid(operator.id);

  await mongoose.connection.transaction(async (session) => {
    const task = await loadTask(taskId, session);
    const job = await Job.findById(task.jobId).session(session).lean();
    if (!job) throw new ServiceError("NOT_FOUND", "Job not found.");
    // Proof of the finished work is required before a stage can be completed.
    const proof = await Photo.exists({ taskId: task._id, kind: "FINISHED" }).session(session);
    if (!proof) throw new ServiceError("CONFLICT", "Add at least one photo of the finished work before completing.");
    const now = new Date();

    const r = await ProductionTask.updateOne(
      { _id: task._id, status: "IN_PROGRESS", activeOperatorId: me },
      { $set: { status: "COMPLETED", completedAt: now, completedBy: me, results }, $unset: { activeOperatorId: 1 } },
      { session },
    );
    if (r.modifiedCount !== 1) throw new ServiceError("CONFLICT", "This work is not in progress under your name.");
    await ProcessingSession.updateOne({ taskId: task._id, endedAt: null }, { $set: { endedAt: now, endReason: "COMPLETE" } }, { session });

    const word = STAGE_WORD[task.stage as Stage];
    const event = { type: `${task.stage}_COMPLETED`, actorId: operator.id, note: `${word} completed · ${results.quantityCompleted} panels` };

    if (task.stage === "CUTTING" && job.operations?.edging) {
      const seq = await nextSequence("queue:edging", session);
      const released = await ProductionTask.updateOne(
        { jobId: job._id, stage: "EDGING", status: "BLOCKED" },
        { $set: { status: "QUEUED", queueSeq: seq, queuedAt: now } },
        { session },
      );
      if (released.modifiedCount !== 1) throw new ServiceError("CONFLICT", "The edging stage for this job is missing.");
      await notifyStageOperators("EDGING", task.workNumber, session);
      await transitionJob(job._id, "CUTTING_IN_PROGRESS", "QUEUED_FOR_EDGING", event, session);
    } else {
      const from = task.stage === "CUTTING" ? "CUTTING_IN_PROGRESS" : "EDGING_IN_PROGRESS";
      await transitionJob(job._id, from, "COMPLETED", event, session);
      await recordJobEvent(job._id, { type: "JOB_COMPLETED", actorId: operator.id, note: "All work finished" }, session);
    }
  });
}

const CUT_KEY = /^\d{1,4}:\d{1,5}$/;

/**
 * Ticks a cutting guide step off (or back on). Only the operator working the
 * stage, while it is in progress; it never blocks completion.
 */
export async function markCut(operator: Operator, taskId: string, key: string, done: boolean) {
  if (operator.role !== "OPERATOR") throw new ServiceError("FORBIDDEN", "Only operators tick cuts off.");
  if (!CUT_KEY.test(key)) throw new ServiceError("INVALID", "Unknown cut.");
  await connectDb();
  const r = await ProductionTask.updateOne(
    { _id: oid(taskId), stage: "CUTTING", status: "IN_PROGRESS", activeOperatorId: oid(operator.id) },
    done ? { $addToSet: { cutsDone: key } } : { $pull: { cutsDone: key } },
  );
  if (r.matchedCount !== 1) throw new ServiceError("CONFLICT", "Start or resume this job to tick cuts off.");
}

// ── Reading ─────────────────────────────────────────────────────────────────

/** Active time from sessions; an open session counts up to now. */
export function activeMs(sessions: Array<{ startedAt: Date; endedAt?: Date | null }>, now = new Date()) {
  return sessions.reduce((ms, s) => ms + ((s.endedAt ?? now).getTime() - s.startedAt.getTime()), 0);
}

/** Everything this operator may take or is working on, oldest first. */
export async function operatorQueue(operatorId: string) {
  await connectDb();
  const me = oid(operatorId);
  const tasks = await ProductionTask.find(visibleFilter(me, await capabilitiesOf(me)))
    .sort({ queueSeq: 1, createdAt: 1 })
    .lean();
  const items = tasks.map((t) => ({ id: t._id.toString(), workNumber: t.workNumber, status: t.status, queueSeq: t.queueSeq ?? null, stage: t.stage }));
  const rules = eligibility(items);
  const jobs = await Job.find({ _id: { $in: tasks.map((t) => t.jobId) } }).select("title operations").lean();
  const jobById = new Map(jobs.map((j) => [j._id.toString(), j]));
  return tasks.map((t) => ({ task: t, job: jobById.get(t.jobId.toString()), rule: rules.get(t._id.toString())! }));
}

export async function listStageQueue(stage: Stage) {
  await connectDb();
  const tasks = await ProductionTask.find({ stage, status: { $in: ["QUEUED", "IN_PROGRESS", "PAUSED", "BLOCKED"] } })
    .sort({ queueSeq: 1, createdAt: 1 })
    .lean();
  const ops = await User.find({ _id: { $in: tasks.flatMap((t) => [t.assignedOperatorId, t.activeOperatorId]).filter(Boolean) } })
    .select("name")
    .lean();
  const name = new Map(ops.map((o) => [o._id.toString(), o.name]));
  return tasks.map((t) => ({ task: t, operatorName: t.assignedOperatorId ? name.get(t.assignedOperatorId.toString()) : undefined }));
}

export async function tasksForJob(jobId: Types.ObjectId) {
  const tasks = await ProductionTask.find({ jobId }).sort({ stage: 1 }).lean();
  const sessions = await ProcessingSession.find({ taskId: { $in: tasks.map((t) => t._id) } }).sort({ startedAt: 1 }).lean();
  return tasks.map((t) => ({ task: t, sessions: sessions.filter((s) => s.taskId.equals(t._id)) }));
}

export async function operatorHistory(operatorId: string) {
  await connectDb();
  const me = oid(operatorId);
  const tasks = await ProductionTask.find({ completedBy: me, status: "COMPLETED" }).sort({ completedAt: -1 }).limit(100).lean();
  const sessions = await ProcessingSession.find({ taskId: { $in: tasks.map((t) => t._id) } }).lean();
  return tasks.map((t) => ({ task: t, activeMs: activeMs(sessions.filter((s) => s.taskId.equals(t._id))) }));
}

/**
 * A task with everything its page shows. Operators may open open work in
 * their stages that nobody else has taken, their own, and what they
 * completed; staff may open any.
 */
export async function getTaskForViewer(viewer: { id: string; role: string }, taskId: string) {
  if (!mongoose.isValidObjectId(taskId)) return null;
  await connectDb();
  const task = await ProductionTask.findById(taskId).lean();
  if (!task) return null;
  let capabilities: string[] = [];
  if (viewer.role === "OPERATOR") {
    capabilities = await capabilitiesOf(viewer.id);
    if (!operatorCanSee(task, { id: viewer.id, capabilities })) return null;
  } else if (viewer.role !== "SUPER_ADMIN" && viewer.role !== "ADMIN") {
    return null;
  }
  const job = await Job.findById(task.jobId).lean();
  if (!job) return null;
  const sessions = await ProcessingSession.find({ taskId: task._id }).sort({ startedAt: 1 }).lean();
  const rule =
    viewer.role === "OPERATOR" && task.status !== "COMPLETED"
      ? eligibility(await visibleQueueItems(new mongoose.Types.ObjectId(viewer.id), capabilities)).get(task._id.toString())
      : undefined;
  return { task, job, sessions, rule };
}
