import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, NO_EDGES } from "@/lib/cutlist";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { clientJobView } from "@/server/services/clientView";
import { approveCutlist, generatePlan } from "@/server/services/cutlists";
import { createJob } from "@/server/services/jobs";
import { completeTask, startTask } from "@/server/services/production";
import { bootstrapSuperAdmin, provisionAccount, provisionClient, type Actor } from "@/server/services/users";
import { addFinishedPhoto, connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("client job view (MongoDB)", () => {
  let root: Actor;
  let op: { id: string; role: "OPERATOR" };
  let client: { userId: string; profileId: string };
  let other: string;

  async function job(edging: boolean) {
    const j = await createJob(root, { clientId: client.profileId, cutting: true, edging, materialsAvailable: true, cuttingOperatorId: op.id });
    await generatePlan(root, j.workNumber, {
      parts: [{ ref: "P1", length: 600, width: 400, quantity: 2, grain: "NONE", edges: NO_EDGES }],
      stockSheets: [{ ref: "S1", length: 2440, width: 1220, quantity: 2, grained: false }],
      options: DEFAULT_OPTIONS,
    });
    await approveCutlist(root, j.workNumber);
    return j;
  }
  const state = (steps: Array<{ key: string; state: string }>) => Object.fromEntries(steps.map((s) => [s.key, s.state]));

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@cv.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    op = { id: (await provisionAccount(root, { role: "OPERATOR", name: "Olu", phone: "+2348040000001", capabilities: ["CUTTING", "EDGING"] })).user._id.toString(), role: "OPERATOR" };
    const c = await provisionClient(root, { name: "Ada", phone: "+2348040000002" });
    client = { userId: c.user._id.toString(), profileId: c.profile._id.toString() };
    other = (await provisionClient(root, { name: "Other", phone: "+2348040000003" })).user._id.toString();
  });
  afterAll(disconnectTestDb);

  it("hides other clients' jobs", async () => {
    const j = await job(false);
    expect(await clientJobView(other, j.workNumber)).toBeNull();
  });

  it("shows the operator's name, the queue position and N/A edging", async () => {
    await job(false); // an earlier job, ahead in the queue
    const second = await job(false);
    const v = (await clientJobView(client.userId, second.workNumber))!;
    const s = state(v.steps);
    expect(s).toMatchObject({ registered: "done", approved: "done", materials: "done", "cut-start": "current", "edge-start": "na", "edge-done": "na" });
    const cutStep = v.steps.find((x) => x.key === "cut-start")!;
    expect(cutStep.detail).toContain("Cutting operator: Olu");
    expect(cutStep.detail).toMatch(/[1-9]\d* jobs? ahead/);
    expect(v.estimate?.totalMin).toBeGreaterThan(0);
  });

  it("ticks steps off from real events as work happens", async () => {
    // Clear the operator's earlier queued jobs so this one is next.
    const queued = await ProductionTask.find({ assignedOperatorId: op.id, status: "QUEUED" }).sort({ queueSeq: 1 }).lean();
    for (const t of queued) {
      await startTask(op, t._id.toString());
      await addFinishedPhoto(t._id.toString(), op.id); await completeTask(op, t._id.toString(), { quantityCompleted: 2, wastePanels: 0, defectivePanels: 0, downtimeMin: 0 });
    }
    const j = await job(false);
    const task = (await ProductionTask.findOne({ jobId: j._id, stage: "CUTTING" }).lean())!;
    await startTask(op, task._id.toString());
    let s = state((await clientJobView(client.userId, j.workNumber))!.steps);
    expect(s["cut-start"]).toBe("done");
    expect(s["cut-done"]).toBe("current");
    await addFinishedPhoto(task._id.toString(), op.id); await completeTask(op, task._id.toString(), { quantityCompleted: 2, wastePanels: 0, defectivePanels: 0, downtimeMin: 0 });
    s = state((await clientJobView(client.userId, j.workNumber))!.steps);
    expect(s).toMatchObject({ "cut-done": "done", completed: "done" });
  });
});
