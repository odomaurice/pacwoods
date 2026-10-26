import "server-only";
import mongoose, { type ClientSession, type Types } from "mongoose";
import { z } from "zod";
import { completionSchema, eligibility, type CompletionInput, type QueueItem, type Stage } from "@/lib/production";

export type { CompletionInput };
import { connectDb } from "@/server/db/connect";
import { nextSequence } from "@/server/db/models/Counter";
import { Job } from "@/server/db/models/Job";
import { ProcessingSession } from "@/server/db/models/ProcessingSession";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { User } from "@/server/db/models/User";
import { audit } from "@/server/services/audit";
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

// ── Assignment (staff) ──────────────────────────────────────────────────────

/**
 * Assigns (or reassigns) a stage of a job to an operator. Reassigning work in
 * progress pauses it first, so the time already spent stays recorded.
 */
export async function assignOperator(actor: Actor, taskId: string, operatorId: string) {
  if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") throw new ServiceError("FORBIDDEN", "Only staff can assign work.");
  await connectDb();
  const operator = oid(operatorId);

  await mongoose.connection.transaction(async (session) => {
    const task = await loadTask(taskId, session);
    if (task.status === "COMPLETED" || task.status === "CANCELLED") throw new ServiceError("CONFLICT", "This work is finished.");
    const op = await assertOperatorCan(operator, task.stage as Stage, session);
    if (task.assignedOperatorId?.equals(operator)) return;

    if (task.status === "IN_PROGRESS") {
      await ProcessingSession.updateOne(
        { taskId: task._id, endedAt: null },
        { $set: { endedAt: new Date(), endReason: "REASSIGN" } },
        { session },
      );
      const r = await ProductionTask.updateOne(
        { _id: task._id, status: "IN_PROGRESS" },
        { $set: { status: "PAUSED", assignedOperatorId: operator }, $unset: { activeOperatorId: 1 } },
        { session },
      );
      if (r.modifiedCount !== 1) throw new ServiceError("CONFLICT", "The task changed. Reload and try again.");
    } else {
      await ProductionTask.updateOne({ _id: task._id }, { $set: { assignedOperatorId: operator } }, { session });
    }
    await recordJobEvent(
      task.jobId,
      {
        type: "OPERATOR_ASSIGNED",
        actorId: actor.id,
        note: `${STAGE_WORD[task.stage as Stage]} assigned to ${op.name}${task.status === "IN_PROGRESS" ? " (work in progress paused)" : ""}`,
        clientVisible: false,
      },
      session,
    );
  });
  await audit({ actorId: actor.id, action: "task.assigned", targetType: "ProductionTask", targetId: taskId, meta: { operatorId } });
}

// ── Operator actions ────────────────────────────────────────────────────────

/** The operator's own open tasks, as the queue rule sees them. */
async function myQueueItems(operatorId: Types.ObjectId, session?: ClientSession): Promise<QueueItem[]> {
  const tasks = await ProductionTask.find({
    assignedOperatorId: operatorId,
    status: { $in: ["BLOCKED", "QUEUED", "IN_PROGRESS", "PAUSED"] },
  })
    .select("workNumber status queueSeq stage")
    .session(session ?? null)
    .lean();
  return tasks.map((t) => ({ id: t._id.toString(), workNumber: t.workNumber, status: t.status, queueSeq: t.queueSeq ?? null, stage: t.stage }));
}

/**
 * Starts (or resumes) a task. Server-side checks, inside one transaction:
 * the operator is active and qualified, the task is theirs, it is the next
 * one in their queue, and they have nothing else in progress. The status
 * change is conditional, and the database refuses a second active task.
 */
export async function startTask(operator: Operator, taskId: string) {
  if (operator.role !== "OPERATOR") throw new ServiceError("FORBIDDEN", "Only operators record production work.");
  await connectDb();
  const me = oid(operator.id);

  try {
    await mongoose.connection.transaction(async (session) => {
      const task = await loadTask(taskId, session);
      if (!task.assignedOperatorId?.equals(me)) throw new ServiceError("FORBIDDEN", "This work is not assigned to you.");
      await assertOperatorCan(me, task.stage as Stage, session);

      const rule = eligibility(await myQueueItems(me, session)).get(task._id.toString());
      if (!rule?.canStart) throw new ServiceError("CONFLICT", rule?.reason ?? "This work cannot be started now.");

      const resuming = task.status === "PAUSED";
      const now = new Date();
      const r = await ProductionTask.updateOne(
        { _id: task._id, status: task.status, assignedOperatorId: me },
        { $set: { status: "IN_PROGRESS", activeOperatorId: me, ...(task.firstStartedAt ? {} : { firstStartedAt: now }) } },
        { session },
      );
      if (r.modifiedCount !== 1) throw new ServiceError("CONFLICT", "Someone else changed this work. Reload and try again.");
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
      await transitionJob(job._id, "CUTTING_IN_PROGRESS", "QUEUED_FOR_EDGING", event, session);
    } else {
      const from = task.stage === "CUTTING" ? "CUTTING_IN_PROGRESS" : "EDGING_IN_PROGRESS";
      await transitionJob(job._id, from, "COMPLETED", event, session);
      await recordJobEvent(job._id, { type: "JOB_COMPLETED", actorId: operator.id, note: "All work finished" }, session);
    }
  });
}

export async function reportIssue(operator: Operator, taskId: string, note: string) {
  if (operator.role !== "OPERATOR") throw new ServiceError("FORBIDDEN", "Only operators report production issues.");
  const text = note.trim();
  if (text.length < 3) throw new ServiceError("INVALID", "Describe the issue.");
  await connectDb();
  const task = await loadTask(taskId);
  if (!task.assignedOperatorId?.equals(oid(operator.id))) throw new ServiceError("FORBIDDEN", "This work is not assigned to you.");
  await recordJobEvent(task.jobId, { type: "ISSUE_REPORTED", actorId: operator.id, note: text.slice(0, 1000), clientVisible: false });
}

// ── Reading ─────────────────────────────────────────────────────────────────

/** Active time from sessions; an open session counts up to now. */
export function activeMs(sessions: Array<{ startedAt: Date; endedAt?: Date | null }>, now = new Date()) {
  return sessions.reduce((ms, s) => ms + ((s.endedAt ?? now).getTime() - s.startedAt.getTime()), 0);
}

export async function operatorQueue(operatorId: string) {
  await connectDb();
  const me = oid(operatorId);
  const tasks = await ProductionTask.find({ assignedOperatorId: me, status: { $in: ["BLOCKED", "QUEUED", "IN_PROGRESS", "PAUSED"] } })
    .sort({ queueSeq: 1 })
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

export async function listOperatorsFor(stage: Stage) {
  await connectDb();
  return User.find({ role: "OPERATOR", status: "ACTIVE", capabilities: stage }).select("name").sort({ name: 1 }).lean();
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
 * A task with everything its page shows. Operators may only open tasks
 * assigned to them (or that they completed); staff may open any.
 */
export async function getTaskForViewer(viewer: { id: string; role: string }, taskId: string) {
  if (!mongoose.isValidObjectId(taskId)) return null;
  await connectDb();
  const task = await ProductionTask.findById(taskId).lean();
  if (!task) return null;
  if (viewer.role === "OPERATOR") {
    const mine = task.assignedOperatorId?.toString() === viewer.id || task.completedBy?.toString() === viewer.id;
    if (!mine) return null;
  } else if (viewer.role !== "SUPER_ADMIN" && viewer.role !== "ADMIN") {
    return null;
  }
  const job = await Job.findById(task.jobId).lean();
  if (!job) return null;
  const sessions = await ProcessingSession.find({ taskId: task._id }).sort({ startedAt: 1 }).lean();
  const rule =
    viewer.role === "OPERATOR" && task.assignedOperatorId?.toString() === viewer.id
      ? eligibility(await myQueueItems(new mongoose.Types.ObjectId(viewer.id))).get(task._id.toString())
      : undefined;
  return { task, job, sessions, rule };
}
