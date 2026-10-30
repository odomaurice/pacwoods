import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, NO_EDGES } from "@/lib/cutlist";
import { Job } from "@/server/db/models/Job";
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";
import { generatePlan } from "@/server/services/cutlists";
import { planMaterials } from "@/server/services/jobMaterials";
import { createJob, saveJobMaterials } from "@/server/services/jobs";
import { bootstrapSuperAdmin, provisionClient, type Actor } from "@/server/services/users";
import { connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("job materials (MongoDB)", () => {
  let root: Actor;
  let clientId: string;
  const plan = (quantity: number) => ({
    parts: [{ ref: "P1", length: 1200, width: 1200, quantity, grain: "NONE" as const, edges: NO_EDGES }],
    stockSheets: [{ ref: "S1", label: "White melamine", length: 2440, width: 1220, quantity: 10, grained: false }],
    options: DEFAULT_OPTIONS,
  });

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@mat.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    clientId = (await provisionClient(root, { name: "C", phone: "0803 555 0101" })).profile._id.toString();
  });
  afterAll(disconnectTestDb);

  it("reads the sheets each job's cutting plan needs", async () => {
    const planned = await createJob(root, { clientId, cutting: true, edging: false });
    await generatePlan(root, planned.workNumber, plan(4)); // two panels per sheet: 2 sheets
    const noPlan = await createJob(root, { clientId, cutting: true, edging: false });

    expect(await planMaterials(planned._id)).toEqual([expect.objectContaining({ name: "White melamine", sheetLengthMm: 2440, sheetWidthMm: 1220, sheets: 2 })]);
    expect(await planMaterials(noPlan._id)).toEqual([]);
  });

  it("records the boards staff enter, on the timeline, and validates them", async () => {
    const job = await createJob(root, { clientId, cutting: true, edging: false });
    await saveJobMaterials(root, job.workNumber, [
      { name: "Grey melamine", thicknessMm: 18, sheetLengthMm: 2440, sheetWidthMm: 1220, sheets: 3, suppliedBy: "CLIENT", note: "Colour 4021" },
      { name: "Backing board", thicknessMm: 3, sheets: 1 },
    ]);
    const saved = (await Job.findById(job._id).lean())!;
    expect(saved.materials).toHaveLength(2);
    expect(saved.materials[0]).toMatchObject({ name: "Grey melamine", sheets: 3, suppliedBy: "CLIENT", note: "Colour 4021" });
    const event = await JobStatusEvent.findOne({ jobId: job._id, type: "MATERIAL_DETAILS" }).lean();
    expect(event?.note).toBe("Materials recorded: Grey melamine 18 mm × 3, Backing board 3 mm × 1");

    await expect(saveJobMaterials(root, job.workNumber, [{ name: "X", sheets: 0 }])).rejects.toMatchObject({ code: "INVALID" });
    await expect(saveJobMaterials(root, job.workNumber, [{ name: "", sheets: 1 }])).rejects.toMatchObject({ code: "INVALID" });
    await expect(saveJobMaterials({ id: root.id, role: "OPERATOR", permissions: [] }, job.workNumber, [])).rejects.toMatchObject({ code: "FORBIDDEN" });

    await saveJobMaterials(root, job.workNumber, []);
    expect((await Job.findById(job._id).lean())!.materials).toHaveLength(0);
  });
});
