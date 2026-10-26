import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Issue } from "@/server/db/models/Issue";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { staffDashboard } from "@/server/services/dashboard";
import { clientIssuesForJob, countOpenIssues, reportIssueAsClient, reportIssueAsOperator, resolveIssue } from "@/server/services/issues";
import { createJob } from "@/server/services/jobs";
import { bootstrapSuperAdmin, provisionAccount, provisionClient, type Actor } from "@/server/services/users";
import { connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("issues and dashboard (MongoDB)", () => {
  let root: Actor;
  let op: { id: string; role: "OPERATOR" };
  let otherOp: { id: string; role: "OPERATOR" };
  let client: { id: string; role: "CLIENT" };
  let stranger: { id: string; role: "CLIENT" };
  let workNumber: string;
  let taskId: string;

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@iss.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    const mkOp = async (name: string, phone: string) => ({ id: (await provisionAccount(root, { role: "OPERATOR", name, phone, capabilities: ["CUTTING"] })).user._id.toString(), role: "OPERATOR" as const });
    op = await mkOp("Op", "+2348050000001");
    otherOp = await mkOp("Other", "+2348050000002");
    const c = await provisionClient(root, { name: "C", phone: "+2348050000003" });
    client = { id: c.user._id.toString(), role: "CLIENT" };
    stranger = { id: (await provisionClient(root, { name: "S", phone: "+2348050000004" })).user._id.toString(), role: "CLIENT" };
    const job = await createJob(root, { clientId: c.profile._id.toString(), cutting: true, edging: false, cuttingOperatorId: op.id });
    workNumber = job.workNumber;
    taskId = (await ProductionTask.findOne({ jobId: job._id }).lean())!._id.toString();
  });
  afterAll(disconnectTestDb);

  it("lets only the assigned operator report on a task", async () => {
    await reportIssueAsOperator(op, taskId, { category: "MACHINE", description: "Saw blade chipping edges" });
    await expect(reportIssueAsOperator(otherOp, taskId, { category: "OTHER", description: "Not mine to report" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(reportIssueAsOperator(op, taskId, { category: "OTHER", description: "x" })).rejects.toMatchObject({ code: "INVALID" });
  });

  it("lets only the owning client report on a job", async () => {
    await reportIssueAsClient(client, workNumber, { category: "DELAY", description: "When will it be ready?" });
    await expect(reportIssueAsClient(stranger, workNumber, { category: "OTHER", description: "Someone else's job" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("resolves once, by staff only, and the client sees the note", async () => {
    expect(await countOpenIssues()).toBe(2);
    const clientIssue = await Issue.findOne({ reporterRole: "CLIENT" }).lean();
    await expect(resolveIssue({ id: op.id, role: "OPERATOR", permissions: [] }, clientIssue!._id.toString(), "Not allowed")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(resolveIssue(root, clientIssue!._id.toString(), "")).rejects.toMatchObject({ code: "INVALID" });
    await resolveIssue(root, clientIssue!._id.toString(), "Ready on Friday, we will call you.");
    await expect(resolveIssue(root, clientIssue!._id.toString(), "Again")).rejects.toMatchObject({ code: "CONFLICT" });
    const mine = await clientIssuesForJob(client.id, clientIssue!.jobId);
    expect(mine[0].status).toBe("RESOLVED");
    expect(mine[0].resolution).toContain("Friday");
    expect(await countOpenIssues()).toBe(1);
  });

  it("dashboard figures come from the data", async () => {
    const d = await staffDashboard();
    expect(d.kpis.openIssues).toBe(1);
    expect(d.kpis.active).toBe(1);
    expect(d.byStatus.DRAFT).toBe(1);
    expect(d.jobsPerDay).toHaveLength(14);
    expect(d.jobsPerDay.reduce((a, x) => a + x.jobs, 0)).toBe(1);
    expect(d.workload).toEqual([expect.objectContaining({ name: "Op", cutting: 1, edging: 0 })]);
  });
});
