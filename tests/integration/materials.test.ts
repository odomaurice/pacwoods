import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, NO_EDGES } from "@/lib/cutlist";
import { Job } from "@/server/db/models/Job";
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";
import { approveCutlist, generatePlan, reopenCutlist } from "@/server/services/cutlists";
import { confirmMaterials, createJob, withdrawMaterials } from "@/server/services/jobs";
import { bootstrapSuperAdmin, provisionClient, type Actor } from "@/server/services/users";
import { connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("materials available (MongoDB)", () => {
  let root: Actor;
  let clientId: string;

  const cutlist = {
    parts: [{ ref: "P1", label: "Side", length: 700, width: 500, quantity: 2, grain: "NONE" as const, edges: NO_EDGES }],
    stockSheets: [{ ref: "S1", length: 2440, width: 1220, quantity: 5, grained: false }],
    options: DEFAULT_OPTIONS,
  };

  async function approvedJob(materialsAvailable = false) {
    const job = await createJob(root, { clientId, cutting: true, edging: false, materialsAvailable });
    await generatePlan(root, job.workNumber, cutlist);
    await approveCutlist(root, job.workNumber);
    return (await Job.findById(job._id).lean())!;
  }

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@mat.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    clientId = (await provisionClient(root, { name: "C", phone: "+2348070000001" })).profile._id.toString();
  });
  afterAll(disconnectTestDb);

  it("goes straight to the cutting queue when materials were ticked at creation", async () => {
    const job = await approvedJob(true);
    expect(job.status).toBe("QUEUED_FOR_CUTTING");
    expect(job.materialConfirmedAt).toBeInstanceOf(Date);
    expect(job.cuttingQueueSeq).toBeGreaterThan(0);
    const types = (await JobStatusEvent.find({ jobId: job._id }).sort({ at: 1 }).lean()).map((e) => e.type);
    expect(types).toEqual(["JOB_CREATED", "MATERIAL_CONFIRMED", "PLAN_GENERATED", "CUTLIST_APPROVED"]);
  });

  it("waits for materials, then joins the queue when they are confirmed", async () => {
    const job = await approvedJob(false);
    expect(job.status).toBe("AWAITING_MATERIAL");
    await confirmMaterials(root, job.workNumber);
    const after = await Job.findById(job._id).lean();
    expect(after?.status).toBe("QUEUED_FOR_CUTTING");
    await expect(confirmMaterials(root, job.workNumber)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("records materials on a draft without changing its status", async () => {
    const job = await createJob(root, { clientId, cutting: true, edging: false });
    await confirmMaterials(root, job.workNumber);
    const after = await Job.findById(job._id).lean();
    expect(after?.status).toBe("DRAFT");
    expect(after?.materialConfirmedAt).toBeInstanceOf(Date);
  });

  it("orders the queue by when jobs entered it, first come first served", async () => {
    const a = await approvedJob(false);
    const b = await approvedJob(false);
    await confirmMaterials(root, b.workNumber);
    await confirmMaterials(root, a.workNumber);
    const [qa, qb] = await Promise.all([Job.findById(a._id).lean(), Job.findById(b._id).lean()]);
    expect(qb!.cuttingQueueSeq!).toBeLessThan(qa!.cuttingQueueSeq!);
  });

  it("gives simultaneous confirmations distinct queue positions", async () => {
    const jobs = await Promise.all([approvedJob(), approvedJob(), approvedJob(), approvedJob()]);
    await Promise.all(jobs.map((j) => confirmMaterials(root, j.workNumber)));
    const seqs = (await Job.find({ _id: { $in: jobs.map((j) => j._id) } }).lean()).map((j) => j.cuttingQueueSeq);
    expect(new Set(seqs).size).toBe(4);
  });

  it("withdrawing takes the job out of the queue but keeps its place", async () => {
    const job = await approvedJob(true);
    await expect(withdrawMaterials(root, job.workNumber, "")).rejects.toMatchObject({ code: "INVALID" });
    await withdrawMaterials(root, job.workNumber, "Wrong boards delivered");
    const out = await Job.findById(job._id).lean();
    expect(out?.status).toBe("AWAITING_MATERIAL");
    expect(out?.materialConfirmedAt).toBeNull();
    await confirmMaterials(root, job.workNumber);
    const back = await Job.findById(job._id).lean();
    expect(back?.status).toBe("QUEUED_FOR_CUTTING");
    expect(back?.cuttingQueueSeq).toBe(job.cuttingQueueSeq);
  });

  it("a queued job can still be reopened before production", async () => {
    const job = await approvedJob(true);
    await reopenCutlist(root, job.workNumber, "Client changed a size");
    const after = await Job.findById(job._id).lean();
    expect(after?.status).toBe("DRAFT");
    expect(after?.materialConfirmedAt).toBeInstanceOf(Date);
  });
});
