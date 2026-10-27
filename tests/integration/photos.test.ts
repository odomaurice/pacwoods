import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, NO_EDGES } from "@/lib/cutlist";
import { Photo } from "@/server/db/models/Photo";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { approveCutlist, generatePlan } from "@/server/services/cutlists";
import { createJob } from "@/server/services/jobs";
import { canViewJob, deletePhoto, openPhoto, savePhoto } from "@/server/services/photos";
import { completeTask, startTask } from "@/server/services/production";
import { bootstrapSuperAdmin, provisionAccount, provisionClient, type Actor } from "@/server/services/users";
import { connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("photos (MongoDB)", () => {
  let root: Actor;
  let op: { id: string; role: "OPERATOR" };
  let otherOp: { id: string; role: "OPERATOR" };
  let client: { id: string; role: "CLIENT" };
  let stranger: { id: string; role: "CLIENT" };
  let workNumber: string;
  let taskId: string;
  let jpeg: Buffer;
  const done = { quantityCompleted: 2, wastePanels: 0, defectivePanels: 0, downtimeMin: 0 };

  beforeAll(async () => {
    // Tests use the database store, never the real Cloudinary account.
    for (const key of ["CLOUDINARY_URL", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) delete process.env[key];
    await connectTestDb();
    jpeg = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#b07a40" } }).jpeg().toBuffer();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@ph.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    const mk = async (name: string, phone: string) => ({ id: (await provisionAccount(root, { role: "OPERATOR", name, phone, capabilities: ["CUTTING"] })).user._id.toString(), role: "OPERATOR" as const });
    op = await mk("Op", "+2348020000101");
    otherOp = await mk("Other", "+2348020000102");
    const c = await provisionClient(root, { name: "C", phone: "+2348020000103" });
    client = { id: c.user._id.toString(), role: "CLIENT" };
    stranger = { id: (await provisionClient(root, { name: "S", phone: "+2348020000104" })).user._id.toString(), role: "CLIENT" };
    const job = await createJob(root, { clientId: c.profile._id.toString(), cutting: true, edging: false, materialsAvailable: true, cuttingOperatorId: op.id });
    await generatePlan(root, job.workNumber, {
      parts: [{ ref: "P1", length: 600, width: 400, quantity: 2, grain: "NONE", edges: NO_EDGES }],
      stockSheets: [{ ref: "S1", length: 2440, width: 1220, quantity: 2, grained: false }],
      options: DEFAULT_OPTIONS,
    });
    await approveCutlist(root, job.workNumber);
    workNumber = job.workNumber;
    taskId = (await ProductionTask.findOne({ jobId: job._id }).lean())!._id.toString();
  });
  afterAll(disconnectTestDb);

  it("stores wood photos from staff and the job's operator, shrunk and re-encoded", async () => {
    const photo = await savePhoto(root, { workNumber, kind: "MATERIAL", data: jpeg });
    expect(photo.storage).toBe("gridfs");
    expect(photo.width).toBe(1600);
    expect(photo.height).toBe(1200);
    await savePhoto(op, { workNumber, kind: "MATERIAL", data: jpeg });
    await expect(savePhoto(otherOp, { workNumber, kind: "MATERIAL", data: jpeg })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(savePhoto(root, { workNumber, kind: "MATERIAL", data: Buffer.from("not an image") })).rejects.toMatchObject({ code: "INVALID" });
  });

  it("serves photos only to people who may see the job", async () => {
    const photo = await Photo.findOne({ kind: "MATERIAL" }).lean();
    expect(await canViewJob(client, photo!.jobId)).toBe(true);
    expect(await canViewJob(stranger, photo!.jobId)).toBe(false);
    expect(await canViewJob(otherOp, photo!.jobId)).toBe(false);
    const stream = await openPhoto(client, photo!._id.toString(), "thumb");
    const reader = stream!.getReader();
    const first = await reader.read();
    expect(first.value!.byteLength).toBeGreaterThan(0);
    await reader.cancel();
    expect(await openPhoto(stranger, photo!._id.toString(), "full")).toBeNull();
  });

  it("requires a finished-work photo before a stage can be completed", async () => {
    await startTask(op, taskId);
    await expect(completeTask(op, taskId, done)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(savePhoto(otherOp, { workNumber, kind: "FINISHED", taskId, data: jpeg })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const proof = await savePhoto(op, { workNumber, kind: "FINISHED", taskId, data: jpeg });
    await completeTask(op, taskId, done);
    // The proof of a completed stage stays.
    await expect(deletePhoto(op, proof._id.toString())).rejects.toMatchObject({ code: "CONFLICT" });
    // And the closed job takes no more photos.
    await expect(savePhoto(root, { workNumber, kind: "MATERIAL", data: jpeg })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
