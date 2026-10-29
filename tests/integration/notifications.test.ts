import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, NO_EDGES } from "@/lib/cutlist";
import { Notification } from "@/server/db/models/Notification";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { approveCutlist, generatePlan } from "@/server/services/cutlists";
import { reportIssueAsClient, resolveIssue } from "@/server/services/issues";
import { createJob } from "@/server/services/jobs";
import { markAllRead, unreadCount } from "@/server/services/notifications";
import { completeTask, startTask } from "@/server/services/production";
import { bootstrapSuperAdmin, provisionAccount, provisionClient, type Actor } from "@/server/services/users";
import { addFinishedPhoto, connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("notifications (MongoDB)", () => {
  let root: Actor;
  let op: { id: string; role: "OPERATOR" };
  let client: { id: string; role: "CLIENT"; profileId: string };
  let other: string;
  const titles = async (userId: string) => (await Notification.find({ userId }).sort({ createdAt: 1 }).lean()).map((n) => n.title);

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@nt.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    op = { id: (await provisionAccount(root, { role: "OPERATOR", name: "Op", phone: "+2348010000201", capabilities: ["CUTTING"] })).user._id.toString(), role: "OPERATOR" };
    const c = await provisionClient(root, { name: "C", phone: "+2348010000202" });
    client = { id: c.user._id.toString(), role: "CLIENT", profileId: c.profile._id.toString() };
    other = (await provisionClient(root, { name: "O", phone: "+2348010000203" })).user._id.toString();
  });
  afterAll(disconnectTestDb);

  it("tells the client about progress on their job, and only them", async () => {
    const job = await createJob(root, { clientId: client.profileId, cutting: true, edging: false, materialsAvailable: true });
    await generatePlan(root, job.workNumber, {
      parts: [{ ref: "P1", length: 600, width: 400, quantity: 2, grain: "NONE", edges: NO_EDGES }],
      stockSheets: [{ ref: "S1", length: 2440, width: 1220, quantity: 2, grained: false }],
      options: DEFAULT_OPTIONS,
    });
    await approveCutlist(root, job.workNumber);
    const task = (await ProductionTask.findOne({ jobId: job._id }).lean())!._id.toString();
    expect(await titles(op.id)).toEqual([`${job.workNumber} is ready for cutting`]);

    await startTask(op, task);
    await addFinishedPhoto(task, op.id);
    await completeTask(op, task, { quantityCompleted: 2, wastePanels: 0, defectivePanels: 0, downtimeMin: 0 });

    expect(await titles(client.id)).toEqual([
      `The wood for ${job.workNumber} is in the workshop.`,
      `The cutlist for ${job.workNumber} is approved.`,
      `Cutting has started on ${job.workNumber}.`,
      `Cutting is finished on ${job.workNumber}.`,
      `${job.workNumber} is complete and ready for collection.`,
    ]);
    expect(await titles(other)).toEqual([]);
  });

  it("tells staff about problems and the reporter about the resolution", async () => {
    const job = await createJob(root, { clientId: client.profileId, cutting: true, edging: false });
    const issue = await reportIssueAsClient(client, job.workNumber, { category: "DELAY", description: "Any update please?" });
    expect((await titles(root.id)).at(-1)).toBe(`Problem reported on ${job.workNumber}`);
    await resolveIssue(root, issue._id.toString(), "Starts tomorrow morning.");
    expect((await titles(client.id)).at(-1)).toBe(`Your report on ${job.workNumber} is resolved`);
  });

  it("counts unread and marks all read", async () => {
    expect(await unreadCount(client.id)).toBeGreaterThan(0);
    await markAllRead(client.id);
    expect(await unreadCount(client.id)).toBe(0);
  });
});
