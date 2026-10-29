import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, NO_EDGES } from "@/lib/cutlist";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { cutlistTables, materialUsage, productionReport } from "@/server/exports/reports";
import { toXlsx } from "@/server/exports/xlsx";
import { approveCutlist, generatePlan, saveCutlistDraft } from "@/server/services/cutlists";
import { createJob } from "@/server/services/jobs";
import { completeTask, startTask } from "@/server/services/production";
import { bootstrapSuperAdmin, provisionAccount, provisionClient, type Actor } from "@/server/services/users";
import { addFinishedPhoto, connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("exports and reports (MongoDB)", () => {
  let root: Actor;
  let op: { id: string; role: "OPERATOR" };
  let client: { id: string; role: "CLIENT"; profileId: string };
  let other: { id: string; role: "CLIENT" };
  const input = {
    parts: [{ ref: "P1", label: "Door", length: 715, width: 396, quantity: 4, grain: "NONE" as const, edges: { ...NO_EDGES, length1: true } }],
    stockSheets: [{ ref: "S1", length: 2440, width: 1220, quantity: 2, grained: false }],
    options: DEFAULT_OPTIONS,
  };

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@ex.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    op = { id: (await provisionAccount(root, { role: "OPERATOR", name: "Olu", phone: "+2348090000301", capabilities: ["CUTTING"] })).user._id.toString(), role: "OPERATOR" };
    const c = await provisionClient(root, { name: "Ada", phone: "+2348090000302" });
    client = { id: c.user._id.toString(), role: "CLIENT", profileId: c.profile._id.toString() };
    other = { id: (await provisionClient(root, { name: "Other", phone: "+2348090000303" })).user._id.toString(), role: "CLIENT" };
  });
  afterAll(disconnectTestDb);

  it("gives clients only their own approved cutlist; staff also see drafts", async () => {
    const job = await createJob(root, { clientId: client.profileId, cutting: true, edging: false });
    await saveCutlistDraft(root, job.workNumber, input);
    expect(await cutlistTables(job.workNumber, client)).toBeNull(); // draft only
    const staffView = await cutlistTables(job.workNumber, root);
    expect(staffView?.tag).toBe("v1 draft");

    await generatePlan(root, job.workNumber, input);
    await approveCutlist(root, job.workNumber);
    const mine = await cutlistTables(job.workNumber, client);
    expect(mine?.tag).toBe("v1 approved");
    expect(mine?.tables.map((t) => t.name)).toEqual(["Panels", "Stock sheets", "Cutting plan"]);
    expect(mine?.tables[0].rows[0]).toEqual(expect.arrayContaining([job.workNumber, "Door", 715, 396, 4, "1 side (1 long)"]));
    expect(await cutlistTables(job.workNumber, other)).toBeNull();
    expect(await cutlistTables(job.workNumber, op)).toBeNull();

    const xlsx = await toXlsx(mine!.tables);
    expect(xlsx.subarray(0, 2).toString()).toBe("PK");
  });

  it("reports completed work and board used in the period", async () => {
    const job = await createJob(root, { clientId: client.profileId, cutting: true, edging: false, materialsAvailable: true });
    await generatePlan(root, job.workNumber, input);
    await approveCutlist(root, job.workNumber);
    const task = (await ProductionTask.findOne({ jobId: job._id }).lean())!._id.toString();
    await startTask(op, task);
    await addFinishedPhoto(task, op.id);
    await completeTask(op, task, { quantityCompleted: 4, wastePanels: 1, defectivePanels: 0, downtimeMin: 5 });

    const from = new Date(Date.now() - 60 * 60 * 1000);
    const to = new Date(Date.now() + 60 * 60 * 1000);
    const report = await productionReport(from, to);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ workNumber: job.workNumber, stage: "Cutting", operator: "Olu", panels: 4, waste: 1, downtime: 5 });
    expect(report.operators).toEqual([expect.objectContaining({ operator: "Olu", stages: 1, panels: 4 })]);

    const materials = await materialUsage(from, to);
    expect(materials.reduce((t, m) => t + m.sheets, 0)).toBe(2); // two approved plans, one sheet each
  });
});
