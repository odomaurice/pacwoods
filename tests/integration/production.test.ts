import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, NO_EDGES } from "@/lib/cutlist";
import { Job } from "@/server/db/models/Job";
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";
import { Notification } from "@/server/db/models/Notification";
import { ProcessingSession } from "@/server/db/models/ProcessingSession";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { approveCutlist, generatePlan } from "@/server/services/cutlists";
import { confirmMaterials, createJob, updateDraftJob } from "@/server/services/jobs";
import { completeTask, getTaskForViewer, markCut, operatorQueue, pauseTask, releaseTask, startTask } from "@/server/services/production";
import { bootstrapSuperAdmin, provisionAccount, provisionClient, setUserStatus, type Actor } from "@/server/services/users";
import { addFinishedPhoto, connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

type Op = { id: string; role: "OPERATOR" };

describe.skipIf(!hasDatabase)("production queues (MongoDB)", () => {
  let root: Actor;
  let clientId: string;
  let cutter: Op;
  let allRounder: Op;
  let other: Op;
  let phone = 100;
  const done = { quantityCompleted: 2, wastePanels: 0, defectivePanels: 0, downtimeMin: 0 };

  const mk = async (name: string, capabilities: ("CUTTING" | "CNC" | "EDGING")[] = ["CUTTING"]): Promise<Op> => ({
    id: (await provisionAccount(root, { role: "OPERATOR", name, phone: `+23480600${String(phone++).padStart(5, "0")}`, capabilities })).user._id.toString(),
    role: "OPERATOR",
  });

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
  const task = async (id: string) => (await ProductionTask.findById(id).lean())!;
  const seen = async (op: Op) => (await operatorQueue(op.id)).map((r) => r.task._id.toString());
  const finish = async (op: Op, id: string) => {
    await addFinishedPhoto(id, op.id);
    await completeTask(op, id, done);
  };

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@prod.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    clientId = (await provisionClient(root, { name: "C", phone: "+2348060000001" })).profile._id.toString();
    cutter = await mk("Cutter");
    allRounder = await mk("Both", ["CUTTING", "EDGING"]);
    other = await mk("Other");
  });
  afterAll(disconnectTestDb);
  // The queue is shared by everyone: start each test with it empty, or
  // first-in-first-out would make earlier tests' jobs block later ones.
  beforeEach(async () => {
    await ProductionTask.updateMany({ status: { $in: ["BLOCKED", "QUEUED", "PAUSED", "IN_PROGRESS"] } }, { $set: { status: "CANCELLED" }, $unset: { activeOperatorId: 1 } });
  });

  it("creates a queued cutting task and a waiting edging task, taken by nobody", async () => {
    const { job, cutId, edgeId } = await queuedJob(true);
    expect((await task(cutId)).status).toBe("QUEUED");
    expect((await task(edgeId!)).status).toBe("BLOCKED");
    expect((await task(cutId)).assignedOperatorId).toBeUndefined();
    expect(await status(job._id)).toBe("QUEUED_FOR_CUTTING");
  });

  it("shows open work to every qualified operator until one of them starts it", async () => {
    const { cutId, edgeId } = await queuedJob(true);
    expect(await seen(cutter)).toContain(cutId);
    expect(await seen(other)).toContain(cutId);
    expect(await seen(cutter)).not.toContain(edgeId); // no edging skill
    expect(await seen(allRounder)).toEqual(expect.arrayContaining([cutId, edgeId]));

    await startTask(cutter, cutId);
    expect((await task(cutId)).assignedOperatorId?.toString()).toBe(cutter.id);
    expect(await seen(cutter)).toContain(cutId);
    expect(await seen(other)).not.toContain(cutId);
    expect(await getTaskForViewer(other, cutId)).toBeNull();
    await expect(startTask(other, cutId)).rejects.toMatchObject({ code: "CONFLICT" });
    // Edging needs the skill.
    await expect(startTask(cutter, edgeId!)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await finish(cutter, cutId);
  });

  it("lets only one of several operators pressing Start at once take the job", async () => {
    const ops = await Promise.all([mk("R1"), mk("R2"), mk("R3")]);
    const { cutId } = await queuedJob(false);
    const results = await Promise.allSettled(ops.map((op) => startTask(op, cutId)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await ProcessingSession.countDocuments({ taskId: cutId })).toBe(1);
    const winner = ops[results.findIndex((r) => r.status === "fulfilled")];
    expect((await task(cutId)).assignedOperatorId?.toString()).toBe(winner.id);
    await finish(winner, cutId);
  });

  it("takes the oldest job first, and a job someone took does not hold others up", async () => {
    const first = await queuedJob(false);
    const second = await queuedJob(false);

    await expect(startTask(cutter, second.cutId)).rejects.toMatchObject({ code: "CONFLICT" });
    await startTask(cutter, first.cutId);
    // One job at a time for the same operator.
    await expect(startTask(cutter, second.cutId)).rejects.toMatchObject({ code: "CONFLICT" });
    // The first job is taken, so the second is now the oldest for everyone else.
    await startTask(other, second.cutId);
    await finish(cutter, first.cutId);
    await finish(other, second.cutId);
  });

  it("keeps paused work with its operator, who must finish it before taking newer work", async () => {
    const op = await mk("P");
    const { job, cutId } = await queuedJob(false);
    await startTask(op, cutId);
    await expect(pauseTask(op, cutId, "")).rejects.toMatchObject({ code: "INVALID" });
    await pauseTask(op, cutId, "Blade change");
    expect((await task(cutId)).status).toBe("PAUSED");
    expect(await status(job._id)).toBe("CUTTING_IN_PROGRESS");

    // Still theirs: hidden from others, who move on to the next job.
    expect(await seen(other)).not.toContain(cutId);
    await expect(startTask(other, cutId)).rejects.toMatchObject({ code: "CONFLICT" });
    const newer = await queuedJob(false);
    await expect(startTask(op, newer.cutId)).rejects.toMatchObject({ code: "CONFLICT" });
    await startTask(other, newer.cutId);

    await startTask(op, cutId);
    await finish(op, cutId);
    const sessions = await ProcessingSession.find({ taskId: cutId }).sort({ startedAt: 1 }).lean();
    expect(sessions.map((s) => s.endReason)).toEqual(["PAUSE", "COMPLETE"]);
    expect(await status(job._id)).toBe("COMPLETED");
    await finish(other, newer.cutId);
  });

  it("offers edging only after cutting, and tells the edging operators", async () => {
    const edger = await mk("Edger", ["EDGING"]);
    const { job, cutId, edgeId } = await queuedJob(true);
    await expect(startTask(allRounder, edgeId!)).rejects.toMatchObject({ code: "CONFLICT" });

    await startTask(allRounder, cutId);
    await finish(allRounder, cutId);
    expect(await status(job._id)).toBe("QUEUED_FOR_EDGING");
    expect((await task(edgeId!)).status).toBe("QUEUED");
    expect((await task(edgeId!)).assignedOperatorId).toBeUndefined();
    expect(await Notification.exists({ userId: edger.id, title: `${job.workNumber} is ready for edging` })).not.toBeNull();

    await startTask(edger, edgeId!);
    expect(await status(job._id)).toBe("EDGING_IN_PROGRESS");
    await finish(edger, edgeId!);
    expect(await status(job._id)).toBe("COMPLETED");

    const types = (await JobStatusEvent.find({ jobId: job._id }).sort({ at: 1 }).lean()).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["CUTTING_STARTED", "CUTTING_COMPLETED", "EDGING_STARTED", "EDGING_COMPLETED", "JOB_COMPLETED"]));
  });

  it("runs cutting, then CNC machining, then edging, each for operators with that skill", async () => {
    const machinist = await mk("Machinist", ["CNC"]);
    const edger = await mk("Edger2", ["EDGING"]);
    const job = await createJob(root, { clientId, cutting: true, cnc: true, edging: true, materialsAvailable: true });
    await generatePlan(root, job.workNumber, {
      parts: [{ ref: "P1", length: 600, width: 400, quantity: 2, grain: "NONE", edges: NO_EDGES, machining: "2 hinge holes" }],
      stockSheets: [{ ref: "S1", length: 2440, width: 1220, quantity: 2, grained: false }],
      options: DEFAULT_OPTIONS,
    });
    await approveCutlist(root, job.workNumber);
    const ids = Object.fromEntries((await ProductionTask.find({ jobId: job._id }).lean()).map((t) => [t.stage, t._id.toString()]));
    expect(Object.keys(ids).sort()).toEqual(["CNC", "CUTTING", "EDGING"]);
    await expect(startTask(machinist, ids.CNC)).rejects.toMatchObject({ code: "CONFLICT" }); // waits for cutting
    await expect(startTask(cutter, ids.CNC)).rejects.toMatchObject({ code: "FORBIDDEN" }); // no CNC skill

    await startTask(cutter, ids.CUTTING);
    await finish(cutter, ids.CUTTING);
    expect(await status(job._id)).toBe("QUEUED_FOR_CNC");
    expect((await task(ids.CNC)).status).toBe("QUEUED");
    expect((await task(ids.EDGING)).status).toBe("BLOCKED");
    expect(await Notification.exists({ userId: machinist.id, title: `${job.workNumber} is ready for CNC machining` })).not.toBeNull();

    await startTask(machinist, ids.CNC);
    expect(await status(job._id)).toBe("CNC_IN_PROGRESS");
    await finish(machinist, ids.CNC);
    expect(await status(job._id)).toBe("QUEUED_FOR_EDGING");

    await startTask(edger, ids.EDGING);
    await finish(edger, ids.EDGING);
    expect(await status(job._id)).toBe("COMPLETED");
  });

  it("tells qualified operators when a job is ready to cut", async () => {
    const { job } = await queuedJob(false);
    const told = await Notification.find({ title: `${job.workNumber} is ready for cutting` }).lean();
    expect(told.map((n) => n.userId.toString())).toEqual(expect.arrayContaining([cutter.id, allRounder.id, other.id]));
  });

  it("stops a suspended operator from starting work", async () => {
    const op = await mk("S");
    const { cutId } = await queuedJob(false);
    await setUserStatus(root, op.id, "SUSPENDED");
    await expect(startTask(op, cutId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets staff release taken work back to the queue, pausing it and keeping the time spent", async () => {
    const first = await mk("First");
    const second = await mk("Second");
    const { cutId } = await queuedJob(false);
    await startTask(first, cutId);
    await expect(releaseTask({ id: first.id, role: "OPERATOR", permissions: [] }, cutId)).rejects.toMatchObject({ code: "FORBIDDEN" });

    await releaseTask(root, cutId);
    const released = await task(cutId);
    expect(released.status).toBe("PAUSED");
    expect(released.assignedOperatorId).toBeUndefined();
    expect(released.activeOperatorId).toBeUndefined();
    expect((await ProcessingSession.find({ taskId: cutId }).lean()).map((x) => x.endReason)).toEqual(["REASSIGN"]);
    await expect(releaseTask(root, cutId)).rejects.toMatchObject({ code: "CONFLICT" });

    expect(await seen(second)).toContain(cutId);
    await startTask(second, cutId);
    await finish(second, cutId);
  });

  it("creates production stages with the job, waiting and taken by nobody", async () => {
    const job = await createJob(root, { clientId, cutting: true, edging: true });
    const tasks = await ProductionTask.find({ jobId: job._id }).lean();
    expect(tasks.map((t) => [t.stage, t.status, t.assignedOperatorId]).sort()).toEqual([
      ["CUTTING", "BLOCKED", undefined],
      ["EDGING", "BLOCKED", undefined],
    ]);
  });

  it("keeps the edging stage in step with a draft's edging choice", async () => {
    const job = await createJob(root, { clientId, cutting: true, edging: false });
    expect(await ProductionTask.countDocuments({ jobId: job._id, stage: "EDGING" })).toBe(0);
    await updateDraftJob(root, job.workNumber, { cutting: true, edging: true });
    expect(await ProductionTask.countDocuments({ jobId: job._id, stage: "EDGING" })).toBe(1);
    await updateDraftJob(root, job.workNumber, { cutting: true, edging: false });
    expect(await ProductionTask.countDocuments({ jobId: job._id, stage: "EDGING" })).toBe(0);
  });

  it("shows work that is not queued yet, but it cannot be started", async () => {
    const op = await mk("Early");
    const job = await createJob(root, { clientId, cutting: true, edging: false });
    const id = (await ProductionTask.findOne({ jobId: job._id, stage: "CUTTING" }).lean())!._id.toString();
    expect(await seen(op)).toContain(id);
    await expect(startTask(op, id)).rejects.toMatchObject({ code: "CONFLICT" });

    await confirmMaterials(root, job.workNumber);
    await generatePlan(root, job.workNumber, {
      parts: [{ ref: "P1", length: 600, width: 400, quantity: 2, grain: "NONE", edges: NO_EDGES }],
      stockSheets: [{ ref: "S1", length: 2440, width: 1220, quantity: 2, grained: false }],
      options: DEFAULT_OPTIONS,
    });
    await approveCutlist(root, job.workNumber);
    expect((await task(id)).status).toBe("QUEUED");
    await startTask(op, id);
    await finish(op, id);
  });

it("lets only the operator working the job tick cuts off, without blocking completion", async () => {
    const { cutId } = await queuedJob(false);
    await expect(markCut(cutter, cutId, "1:1", true)).rejects.toMatchObject({ code: "CONFLICT" }); // not started
    await startTask(cutter, cutId);
    await markCut(cutter, cutId, "1:1", true);
    await markCut(cutter, cutId, "1:1", true); // twice is still once
    await markCut(cutter, cutId, "1:2", true);
    await markCut(cutter, cutId, "1:2", false);
    expect((await task(cutId)).cutsDone).toEqual(["1:1"]);
    await expect(markCut(other, cutId, "1:3", true)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(markCut(cutter, cutId, "$where", true)).rejects.toMatchObject({ code: "INVALID" });
    await finish(cutter, cutId); // completing does not need every cut ticked
  });

  it("cannot complete work that is not in progress", async () => {
    const { cutId } = await queuedJob(false);
    await expect(completeTask(cutter, cutId, done)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
