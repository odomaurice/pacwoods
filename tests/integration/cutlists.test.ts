import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, NO_EDGES, type CutlistInput } from "@/lib/cutlist";
import { CutlistVersion } from "@/server/db/models/CutlistVersion";
import { Job } from "@/server/db/models/Job";
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";
import { approveCutlist, generatePlan, reopenCutlist, saveCutlistDraft } from "@/server/services/cutlists";
import { getJobCardData } from "@/server/services/jobCards";
import { createJob } from "@/server/services/jobs";
import { createMaterial } from "@/server/services/materials";
import { bootstrapSuperAdmin, provisionClient, type Actor } from "@/server/services/users";
import { connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("cutlists and job cards (MongoDB)", () => {
  let root: Actor;
  let mdfId: string;
  let clientUserId: string;
  let clientId: string;

  const input = (parts: CutlistInput["parts"]): CutlistInput => ({
    parts,
    stockSheets: [{ ref: "S1", length: 2440, width: 1220, quantity: 5, materialId: mdfId, grained: false }],
    options: { ...DEFAULT_OPTIONS, considerMaterial: true },
  });
  const panel = (ref: string, length: number, width: number, quantity: number, edges = NO_EDGES) => ({
    ref,
    label: ref,
    length,
    width,
    quantity,
    materialId: mdfId,
    grain: "NONE" as const,
    edges,
  });

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@cl.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    const mdf = await createMaterial(root, { name: "MDF", category: "MDF", thicknessMm: 18, grain: "NONE", sheetLengthMm: 2440, sheetWidthMm: 1220 });
    mdfId = mdf._id.toString();
    const c = await provisionClient(root, { name: "Client", phone: "+2348090000001" });
    clientUserId = c.user._id.toString();
    clientId = c.profile._id.toString();
  });
  afterAll(disconnectTestDb);

  async function newJob(edging = true) {
    return createJob(root, { clientId, cutting: true, edging });
  }

  it("saves a draft with material snapshots taken from the catalogue", async () => {
    const job = await newJob();
    const draft = await saveCutlistDraft(root, job.workNumber, input([panel("Side", 720, 560, 2)]));
    expect(draft.version).toBe(1);
    expect(draft.state).toBe("DRAFT");
    expect(draft.parts[0].materialName).toBe("MDF");
    expect(draft.parts[0].thicknessMm).toBe(18);
    expect(draft.plan).toBeNull();
  });

  it("rejects unknown materials and invalid rows", async () => {
    const job = await newJob();
    await expect(
      saveCutlistDraft(root, job.workNumber, { ...input([panel("A", 100, 100, 1)]), parts: [{ ...panel("A", 100, 100, 1), materialId: "64b000000000000000000000" }] }),
    ).rejects.toMatchObject({ code: "INVALID" });
    await expect(saveCutlistDraft(root, job.workNumber, input([panel("A", -5, 100, 1)]))).rejects.toMatchObject({ code: "INVALID" });
  });

  it("generates, approves, and moves the job on with a timeline entry", async () => {
    const job = await newJob();
    const draft = await generatePlan(root, job.workNumber, input([panel("Side", 720, 560, 4, { length1: true, length2: false, width1: true, width2: false })]));
    expect(draft.plan?.unplaced).toEqual([]);
    expect(draft.plan?.totals.sheetsUsed).toBe(1);

    await approveCutlist(root, job.workNumber);
    const after = await Job.findById(job._id).lean();
    expect(after?.status).toBe("AWAITING_MATERIAL");
    const approved = await CutlistVersion.findOne({ jobId: job._id }).lean();
    expect(approved?.state).toBe("APPROVED");
    const events = await JobStatusEvent.find({ jobId: job._id }).sort({ at: 1 }).lean();
    expect(events.map((e) => e.type)).toEqual(["JOB_CREATED", "PLAN_GENERATED", "CUTLIST_APPROVED"]);

    // Approved cutlists are locked.
    await expect(saveCutlistDraft(root, job.workNumber, input([panel("Side", 700, 560, 4)]))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses to approve a stale plan or one with unplaced panels", async () => {
    const job = await newJob();
    await generatePlan(root, job.workNumber, input([panel("A", 500, 500, 1)]));
    await saveCutlistDraft(root, job.workNumber, input([panel("A", 600, 500, 1)]));
    await expect(approveCutlist(root, job.workNumber)).rejects.toMatchObject({ code: "CONFLICT" });

    await generatePlan(root, job.workNumber, input([panel("Huge", 5000, 500, 1)]));
    await expect(approveCutlist(root, job.workNumber)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("lets only one of two simultaneous approvals win", async () => {
    const job = await newJob();
    await generatePlan(root, job.workNumber, input([panel("A", 500, 500, 2)]));
    const results = await Promise.allSettled([approveCutlist(root, job.workNumber), approveCutlist(root, job.workNumber)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await CutlistVersion.countDocuments({ jobId: job._id, state: "APPROVED" })).toBe(1);
    expect(await JobStatusEvent.countDocuments({ jobId: job._id, type: "CUTLIST_APPROVED" })).toBe(1);
  });

  it("reopens an approved cutlist as a new version and keeps the old one until replaced", async () => {
    const job = await newJob();
    await generatePlan(root, job.workNumber, input([panel("A", 500, 500, 1)]));
    await approveCutlist(root, job.workNumber);
    await expect(reopenCutlist(root, job.workNumber, "")).rejects.toMatchObject({ code: "INVALID" });
    await reopenCutlist(root, job.workNumber, "Client changed sizes");

    expect((await Job.findById(job._id).lean())?.status).toBe("DRAFT");
    const versions = await CutlistVersion.find({ jobId: job._id }).sort({ version: 1 }).lean();
    expect(versions.map((v) => [v.version, v.state])).toEqual([[1, "APPROVED"], [2, "DRAFT"]]);

    await generatePlan(root, job.workNumber, input([panel("A", 600, 500, 1)]));
    await approveCutlist(root, job.workNumber);
    const final = await CutlistVersion.find({ jobId: job._id }).sort({ version: 1 }).lean();
    expect(final.map((v) => v.state)).toEqual(["SUPERSEDED", "APPROVED"]);
  });

  it("builds job card data with sides, material and operations, owner-only for clients", async () => {
    const job = await newJob(true);
    await generatePlan(root, job.workNumber, input([panel("Door", 700, 400, 2, { length1: true, length2: true, width1: true, width2: false })]));
    const card = await getJobCardData(job.workNumber, { ownerUserId: clientUserId });
    expect(card?.data.operations).toEqual({ cutting: true, edging: true });
    expect(card?.data.cutlist?.parts[0].materialName).toBe("MDF");
    expect(card?.data.internalNotes).toBeUndefined();
    expect(await getJobCardData(job.workNumber, { ownerUserId: root.id })).toBeNull();
  });
});
