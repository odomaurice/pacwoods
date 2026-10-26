import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, NO_EDGES } from "@/lib/cutlist";
import { Job } from "@/server/db/models/Job";
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";
import { ProcessingSession } from "@/server/db/models/ProcessingSession";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { approveCutlist, generatePlan } from "@/server/services/cutlists";
import { confirmMaterials, createJob, updateDraftJob } from "@/server/services/jobs";
import { assignOperator, completeTask, pauseTask, startTask } from "@/server/services/production";
import { bootstrapSuperAdmin, provisionAccount, provisionClient, setUserStatus, type Actor } from "@/server/services/users";
import { addFinishedPhoto, connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("production queues (MongoDB)", () => {
  let root: Actor;
  let clientId: string;
  let cutter: { id: string; role: "OPERATOR" };
  let allRounder: { id: string; role: "OPERATOR" };
  let other: { id: string; role: "OPERATOR" };
  const done = { quantityCompleted: 2, wastePanels: 0, defectivePanels: 0, downtimeMin: 0 };

  async function queuedJob(edging: boolean) {
    const job = await createJob(root, { clientId, cutting: true, edging, materialsAvailable: true });
    await generatePlan(root, job.workNumber, {
      parts: [{ ref: "P1", length: 600, width: 400, quantity: 2, grain: "NONE", edges: NO_EDGES }],
      stockSheets: [{ ref: "S1", length: 2440, width: 1220, quantity: 2, grained: false }],
      options: DEFAULT_OPTIONS,
    });
    await approveCutlist(root, job.workNumber);
    const tasks = await ProductionTask.find({ jobId: job._id }).lean();
    const cut = tasks.find((t) => t.stage === "CUTTING")!;
    const edge = tasks.find((t) => t.stage === "EDGING");
    return { job, cutId: cut._id.toString(), edgeId: edge?._id.toString() };
  }
  const status = async (jobId: unknown) => (await Job.findById(jobId).lean())!.status;
  const taskStatus = async (id: string) => (await ProductionTask.findById(id).lean())!.status;

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@prod.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    clientId = (await provisionClient(root, { name: "C", phone: "+2348060000001" })).profile._id.toString();
    const mk = async (name: string, phone: string, capabilities: ("CUTTING" | "EDGING")[]) =>
      ({ id: (await provisionAccount(root, { role: "OPERATOR", name, phone, capabilities })).user._id.toString(), role: "OPERATOR" as const });
    cutter = await mk("Cutter", "+2348060000002", ["CUTTING"]);
    allRounder = await mk("Both", "+2348060000003", ["CUTTING", "EDGING"]);
    other = await mk("Other", "+2348060000004", ["CUTTING"]);
  });
  afterAll(disconnectTestDb);

  it("creates a queued cutting task and a waiting edging task", async () => {
    const { job, cutId, edgeId } = await queuedJob(true);
    expect(await taskStatus(cutId)).toBe("QUEUED");
    expect(await taskStatus(edgeId!)).toBe("BLOCKED");
    expect(await status(job._id)).toBe("QUEUED_FOR_CUTTING");
  });

  it("refuses unassigned work, other people's work, and unqualified operators", async () => {
    const { cutId, edgeId } = await queuedJob(true);
    await expect(startTask(cutter, cutId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await assignOperator(root, cutId, cutter.id);
    await expect(startTask(other, cutId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assignOperator(root, edgeId!, cutter.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("enforces queue order and one job at a time", async () => {
    const op = { id: (await provisionAccount(root, { role: "OPERATOR", name: "Q", phone: "+2348060000010", capabilities: ["CUTTING"] })).user._id.toString(), role: "OPERATOR" as const };
    const first = await queuedJob(false);
    const second = await queuedJob(false);
    await assignOperator(root, second.cutId, op.id);
    await assignOperator(root, first.cutId, op.id);

    await expect(startTask(op, second.cutId)).rejects.toMatchObject({ code: "CONFLICT" });
    await startTask(op, first.cutId);
    await expect(startTask(op, second.cutId)).rejects.toMatchObject({ code: "CONFLICT" });
    await addFinishedPhoto(first.cutId, op.id); await completeTask(op, first.cutId, done);
    await startTask(op, second.cutId);
    expect(await taskStatus(second.cutId)).toBe("IN_PROGRESS");
    await addFinishedPhoto(second.cutId, op.id); await completeTask(op, second.cutId, done);
  });

  it("lets only one of two simultaneous starts succeed", async () => {
    const op = { id: (await provisionAccount(root, { role: "OPERATOR", name: "R", phone: "+2348060000011", capabilities: ["CUTTING"] })).user._id.toString(), role: "OPERATOR" as const };
    const { cutId } = await queuedJob(false);
    await assignOperator(root, cutId, op.id);
    const results = await Promise.allSettled([startTask(op, cutId), startTask(op, cutId), startTask(op, cutId)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await ProcessingSession.countDocuments({ taskId: cutId })).toBe(1);
    await addFinishedPhoto(cutId, op.id); await completeTask(op, cutId, done);
  });

  it("pauses without completing, resumes, and keeps every session", async () => {
    const op = { id: (await provisionAccount(root, { role: "OPERATOR", name: "P", phone: "+2348060000012", capabilities: ["CUTTING"] })).user._id.toString(), role: "OPERATOR" as const };
    const { job, cutId } = await queuedJob(false);
    await assignOperator(root, cutId, op.id);
    await startTask(op, cutId);
    await expect(pauseTask(op, cutId, "")).rejects.toMatchObject({ code: "INVALID" });
    await pauseTask(op, cutId, "Blade change");
    expect(await taskStatus(cutId)).toBe("PAUSED");
    expect(await status(job._id)).toBe("CUTTING_IN_PROGRESS");
    await startTask(op, cutId);
    await addFinishedPhoto(cutId, op.id); await completeTask(op, cutId, done);
    const sessions = await ProcessingSession.find({ taskId: cutId }).sort({ startedAt: 1 }).lean();
    expect(sessions.map((s) => s.endReason)).toEqual(["PAUSE", "COMPLETE"]);
    expect(await status(job._id)).toBe("COMPLETED");
  });

  it("releases edging only after cutting, even for one operator doing both", async () => {
    const { job, cutId, edgeId } = await queuedJob(true);
    await assignOperator(root, cutId, allRounder.id);
    await assignOperator(root, edgeId!, allRounder.id);
    await expect(startTask(allRounder, edgeId!)).rejects.toMatchObject({ code: "CONFLICT" });

    await startTask(allRounder, cutId);
    await addFinishedPhoto(cutId, allRounder.id); await completeTask(allRounder, cutId, done);
    expect(await status(job._id)).toBe("QUEUED_FOR_EDGING");
    expect(await taskStatus(edgeId!)).toBe("QUEUED");

    await startTask(allRounder, edgeId!);
    expect(await status(job._id)).toBe("EDGING_IN_PROGRESS");
    await addFinishedPhoto(edgeId!, allRounder.id); await completeTask(allRounder, edgeId!, done);
    expect(await status(job._id)).toBe("COMPLETED");

    const types = (await JobStatusEvent.find({ jobId: job._id }).sort({ at: 1 }).lean()).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["CUTTING_STARTED", "CUTTING_COMPLETED", "EDGING_STARTED", "EDGING_COMPLETED", "JOB_COMPLETED"]));
  });

  it("stops a suspended operator from starting work", async () => {
    const op = { id: (await provisionAccount(root, { role: "OPERATOR", name: "S", phone: "+2348060000013", capabilities: ["CUTTING"] })).user._id.toString(), role: "OPERATOR" as const };
    const { cutId } = await queuedJob(false);
    await assignOperator(root, cutId, op.id);
    await setUserStatus(root, op.id, "SUSPENDED");
    await expect(startTask(op, cutId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reassigning work in progress pauses it and keeps the time spent", async () => {
    // Fresh operators: the shared ones still have earlier jobs queued.
    const mk = async (name: string, phone: string) =>
      ({ id: (await provisionAccount(root, { role: "OPERATOR", name, phone, capabilities: ["CUTTING"] })).user._id.toString(), role: "OPERATOR" as const });
    const first = await mk("First", "+2348060000014");
    const second = await mk("Second", "+2348060000015");
    const { cutId } = await queuedJob(false);
    await assignOperator(root, cutId, first.id);
    await startTask(first, cutId);
    await assignOperator(root, cutId, second.id);
    const task = await ProductionTask.findById(cutId).lean();
    expect(task?.status).toBe("PAUSED");
    expect(task?.activeOperatorId).toBeUndefined();
    const s = await ProcessingSession.find({ taskId: cutId }).lean();
    expect(s.map((x) => x.endReason)).toEqual(["REASSIGN"]);
    await startTask(second, cutId);
    await addFinishedPhoto(cutId, second.id); await completeTask(second, cutId, done);
  });

  it("creates production stages with the job, with operators chosen on the form", async () => {
    const job = await createJob(root, { clientId, cutting: true, edging: true, cuttingOperatorId: cutter.id, edgingOperatorId: allRounder.id });
    const tasks = await ProductionTask.find({ jobId: job._id }).lean();
    expect(tasks.map((t) => [t.stage, t.status, t.assignedOperatorId?.toString()]).sort()).toEqual([
      ["CUTTING", "BLOCKED", cutter.id],
      ["EDGING", "BLOCKED", allRounder.id],
    ]);
    // A cutter cannot be put on edging.
    await expect(createJob(root, { clientId, cutting: true, edging: true, edgingOperatorId: cutter.id })).rejects.toMatchObject({ code: "INVALID" });
  });

  it("keeps the edging stage in step with a draft's edging choice", async () => {
    const job = await createJob(root, { clientId, cutting: true, edging: false });
    expect(await ProductionTask.countDocuments({ jobId: job._id, stage: "EDGING" })).toBe(0);
    await updateDraftJob(root, job.workNumber, { cutting: true, edging: true });
    expect(await ProductionTask.countDocuments({ jobId: job._id, stage: "EDGING" })).toBe(1);
    await updateDraftJob(root, job.workNumber, { cutting: true, edging: false });
    expect(await ProductionTask.countDocuments({ jobId: job._id, stage: "EDGING" })).toBe(0);
  });

  it("assigned work that is not queued yet cannot be started", async () => {
    const op = { id: (await provisionAccount(root, { role: "OPERATOR", name: "Early", phone: "+2348060000016", capabilities: ["CUTTING"] })).user._id.toString(), role: "OPERATOR" as const };
    const job = await createJob(root, { clientId, cutting: true, edging: false, cuttingOperatorId: op.id });
    const task = await ProductionTask.findOne({ jobId: job._id, stage: "CUTTING" }).lean();
    await expect(startTask(op, task!._id.toString())).rejects.toMatchObject({ code: "CONFLICT" });
    // Once approved with materials, the same task (and assignment) is queued.
    await confirmMaterials(root, job.workNumber);
    await generatePlan(root, job.workNumber, {
      parts: [{ ref: "P1", length: 600, width: 400, quantity: 2, grain: "NONE", edges: NO_EDGES }],
      stockSheets: [{ ref: "S1", length: 2440, width: 1220, quantity: 2, grained: false }],
      options: DEFAULT_OPTIONS,
    });
    await approveCutlist(root, job.workNumber);
    const queued = await ProductionTask.findById(task!._id).lean();
    expect(queued?.status).toBe("QUEUED");
    expect(queued?.assignedOperatorId?.toString()).toBe(op.id);
    await startTask(op, task!._id.toString());
    await addFinishedPhoto(task!._id.toString(), op.id); await completeTask(op, task!._id.toString(), done);
  });

  it("cannot complete work that is not in progress", async () => {
    const { cutId } = await queuedJob(false);
    await assignOperator(root, cutId, cutter.id);
    await expect(completeTask(cutter, cutId, done)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
