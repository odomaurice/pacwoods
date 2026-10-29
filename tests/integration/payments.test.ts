import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, NO_EDGES } from "@/lib/cutlist";
import { Job } from "@/server/db/models/Job";
import { Notification } from "@/server/db/models/Notification";
import { Payment } from "@/server/db/models/Payment";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { approveCutlist, generatePlan } from "@/server/services/cutlists";
import { createJob } from "@/server/services/jobs";
import { paymentsOverview, recordClientPayment, recordOperatorPayment, voidPayment } from "@/server/services/payments";
import { completeTask, startTask } from "@/server/services/production";
import { bootstrapSuperAdmin, provisionAccount, provisionClient, type Actor } from "@/server/services/users";
import { addFinishedPhoto, connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("payments (MongoDB)", () => {
  let root: Actor;
  let clientA: string;
  let clientB: string;
  let op: { id: string; role: "OPERATOR" };
  const paymentStatus = async (workNumber: string) => (await Job.findOne({ workNumber }).lean())!.clientPayment;

  async function completedCutting(clientId: string) {
    const job = await createJob(root, { clientId, cutting: true, edging: false, materialsAvailable: true });
    await generatePlan(root, job.workNumber, {
      parts: [{ ref: "P1", length: 600, width: 400, quantity: 2, grain: "NONE", edges: NO_EDGES }],
      stockSheets: [{ ref: "S1", length: 2440, width: 1220, quantity: 2, grained: false }],
      options: DEFAULT_OPTIONS,
    });
    await approveCutlist(root, job.workNumber);
    const taskId = (await ProductionTask.findOne({ jobId: job._id }).lean())!._id.toString();
    return { job, taskId };
  }

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@pay.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    clientA = (await provisionClient(root, { name: "A", businessName: "Alpha Kitchens", phone: "+2348090000501" })).profile._id.toString();
    clientB = (await provisionClient(root, { name: "B", phone: "+2348090000502" })).profile._id.toString();
    op = { id: (await provisionAccount(root, { role: "OPERATOR", name: "Tunde", phone: "+2348090000503", capabilities: ["CUTTING"] })).user._id.toString(), role: "OPERATOR" };
  });
  afterAll(disconnectTestDb);

  it("records the client's payment when the job is created", async () => {
    const paid = await createJob(root, { clientId: clientA, cutting: true, edging: false, payment: { status: "PART", amount: "50,000", method: "TRANSFER", note: "Deposit" } });
    expect(await paymentStatus(paid.workNumber)).toBe("PART");
    const entry = await Payment.findOne({ jobId: paid._id }).lean();
    expect(entry).toMatchObject({ kind: "CLIENT", coverage: "PART", amountMinor: 5_000_000, method: "TRANSFER", note: "Deposit", live: true });

    const unpaid = await createJob(root, { clientId: clientA, cutting: true, edging: false, payment: { status: "UNPAID" } });
    expect(await paymentStatus(unpaid.workNumber)).toBe("UNPAID");
    expect(await Payment.countDocuments({ jobId: unpaid._id })).toBe(0);
  });

  it("moves from part to full, and back when the full payment is voided", async () => {
    const job = await createJob(root, { clientId: clientA, cutting: true, edging: false, payment: { status: "PART", amount: "100" } });
    await recordClientPayment(root, job.workNumber, { coverage: "FULL", amount: "250.50", paidOn: "2026-01-15" });
    expect(await paymentStatus(job.workNumber)).toBe("FULL");
    const full = (await Payment.findOne({ jobId: job._id, coverage: "FULL" }).lean())!;
    expect(full.amountMinor).toBe(25_050);
    expect(full.paidAt.toISOString().slice(0, 10)).toBe("2026-01-15");

    await expect(voidPayment(root, full._id.toString(), "x")).rejects.toMatchObject({ code: "INVALID" });
    await voidPayment(root, full._id.toString(), "Entered on the wrong job");
    expect(await paymentStatus(job.workNumber)).toBe("PART");
    const voided = (await Payment.findById(full._id).lean())!;
    expect(voided.live).toBeUndefined();
    expect(voided.voidReason).toBe("Entered on the wrong job");
    await expect(voidPayment(root, full._id.toString(), "Again please")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects bad amounts, future dates and non-staff", async () => {
    const job = await createJob(root, { clientId: clientB, cutting: true, edging: false });
    await expect(recordClientPayment(root, job.workNumber, { coverage: "PART", amount: "12.345" })).rejects.toMatchObject({ code: "INVALID" });
    await expect(recordClientPayment(root, job.workNumber, { coverage: "PART", amount: "-5" })).rejects.toMatchObject({ code: "INVALID" });
    await expect(recordClientPayment(root, job.workNumber, { coverage: "PART", paidOn: "2999-01-01" })).rejects.toMatchObject({ code: "INVALID" });
    await expect(recordClientPayment({ id: op.id, role: "OPERATOR", permissions: [] }, job.workNumber, { coverage: "FULL" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    // No amount is fine: the figure is not always to hand.
    await recordClientPayment(root, job.workNumber, { coverage: "FULL" });
    expect(await paymentStatus(job.workNumber)).toBe("FULL");
  });

  it("asks staff about operator pay when a stage completes, and records it once per stage", async () => {
    const { job, taskId } = await completedCutting(clientB);
    await expect(recordOperatorPayment(root, taskId, {})).rejects.toMatchObject({ code: "CONFLICT" }); // not completed yet
    await startTask(op, taskId);
    await addFinishedPhoto(taskId, op.id);
    await completeTask(op, taskId, { quantityCompleted: 2, wastePanels: 0, defectivePanels: 0, downtimeMin: 0 });
    expect(await Notification.exists({ userId: root.id, title: `Cutting of ${job.workNumber} is done. Has Tunde been paid?` })).not.toBeNull();

    await recordOperatorPayment(root, taskId, { amount: "8000", method: "CASH" });
    await expect(recordOperatorPayment(root, taskId, { amount: "8000" })).rejects.toMatchObject({ code: "CONFLICT" });
    const entry = (await Payment.findOne({ taskId, kind: "OPERATOR" }).lean())!;
    expect(entry.operatorId?.toString()).toBe(op.id);
    expect(entry.stage).toBe("CUTTING");

    // Voiding frees the stage to be recorded again.
    await voidPayment(root, entry._id.toString(), "Wrong amount");
    await recordOperatorPayment(root, taskId, { amount: "9000" });
    expect(await Payment.countDocuments({ taskId, kind: "OPERATOR", live: true })).toBe(1);
  });

  it("collects everything on the overview, narrowed by client or operator", async () => {
    const all = await paymentsOverview();
    expect(all.jobs.length).toBeGreaterThanOrEqual(5);
    expect(all.totals.receivedMinor).toBe(5_000_000 + 10_000); // voided full payment excluded
    expect(all.totals.paidOutMinor).toBe(900_000);
    expect(all.totals.stagesAwaitingPay).toBe(0);

    const a = await paymentsOverview({ clientId: clientA });
    expect(new Set(a.jobs.map((j) => j.clientName))).toEqual(new Set(["Alpha Kitchens"]));
    expect(a.stages).toHaveLength(0);

    const byOp = await paymentsOverview({ operatorId: op.id });
    expect(byOp.stages.map((s) => s.operatorName)).toEqual(["Tunde"]);
    expect(byOp.jobs).toHaveLength(1);
    expect(byOp.ledger.every((e) => e.kind === "CLIENT" || e.operatorId === op.id)).toBe(true);
  });
});
