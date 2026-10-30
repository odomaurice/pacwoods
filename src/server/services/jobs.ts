import "server-only";
import { randomBytes } from "node:crypto";
import mongoose, { type Types } from "mongoose";
import type { JobStatus } from "@/lib/jobs";
import { describeMaterial, jobMaterialsSchema } from "@/lib/job-materials";
import { jobDetailsSchema, jobSchema, type JobDetailsInput, type JobInput } from "@/lib/schemas";
import { formatWorkNumber, workNumberCounter } from "@/lib/numbers";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { nextSequence } from "@/server/db/models/Counter";
import { Job } from "@/server/db/models/Job";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { User } from "@/server/db/models/User";
import { audit } from "@/server/services/audit";
import { addClientPayment } from "@/server/services/payments";
import { leaveCuttingQueue, queueForCutting, recordJobEvent, transitionJob } from "@/server/workflow/transitions";
import { PAGE_SIZE, ServiceError, type Actor } from "@/server/services/users";

function assertStaff(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
    throw new ServiceError("FORBIDDEN", "Only staff can manage jobs.");
  }
}

export async function createJob(actor: Actor, input: JobInput, now = new Date()) {
  assertStaff(actor);
  const data = jobSchema.parse(input);
  if (!mongoose.isValidObjectId(data.clientId)) throw new ServiceError("INVALID", "Choose a client.");
  await connectDb();

  const client = await ClientProfile.findById(data.clientId).lean();
  const clientUser = client && (await User.findById(client.userId).select("status").lean());
  if (!client || !clientUser) throw new ServiceError("INVALID", "That client does not exist.");
  if (clientUser.status !== "ACTIVE") {
    throw new ServiceError("CONFLICT", "That client's account is not active.");
  }

  const year = now.getFullYear();
  const job = await mongoose.connection.transaction(async (session) => {
    const seq = await nextSequence(workNumberCounter(year), session);
    const [created] = await Job.create(
      [
        {
          workNumber: formatWorkNumber(year, seq),
          clientId: client._id,
          operations: { cutting: data.cutting, edging: data.edging, cnc: Boolean(data.cnc) },
          title: data.title || undefined,
          clientNotes: data.clientNotes || undefined,
          internalNotes: data.internalNotes || undefined,
          qrToken: randomBytes(16).toString("base64url"),
          createdBy: actor.id,
          ...(data.materialsAvailable ? { materialConfirmedAt: new Date(), materialConfirmedBy: actor.id } : {}),
        },
      ],
      { session },
    );
    await recordJobEvent(created._id, { type: "JOB_CREATED", actorId: actor.id, note: "Order registered" }, session);
    // Production stages exist from the start so operators can see the job
    // coming; they stay "waiting" until the job enters the queue, and the
    // first operator to start a stage takes it.
    await ProductionTask.create(
      [
        { jobId: created._id, workNumber: created.workNumber, stage: "CUTTING" as const, status: "BLOCKED" as const },
        ...(data.cnc ? [{ jobId: created._id, workNumber: created.workNumber, stage: "CNC" as const, status: "BLOCKED" as const }] : []),
        ...(data.edging ? [{ jobId: created._id, workNumber: created.workNumber, stage: "EDGING" as const, status: "BLOCKED" as const }] : []),
      ],
      { session, ordered: true },
    );
    if (data.materialsAvailable) {
      await recordJobEvent(created._id, { type: "MATERIAL_CONFIRMED", actorId: actor.id, note: "Materials available" }, session);
    }
    if (data.payment && data.payment.status !== "UNPAID") {
      await addClientPayment(actor, created, { ...data.payment, coverage: data.payment.status }, session);
    }
    return created;
  });

  await audit({
    actorId: actor.id,
    action: "job.created",
    targetType: "Job",
    targetId: job._id,
    meta: { workNumber: job.workNumber },
  });
  return job;
}

/** Drafts can be edited freely; after that, changes go through revisions. */
export async function updateDraftJob(actor: Actor, workNumber: string, input: JobDetailsInput) {
  assertStaff(actor);
  const data = jobDetailsSchema.parse(input);
  await connectDb();
  const job = await Job.findOneAndUpdate(
    { workNumber, status: "DRAFT" },
    {
      $set: {
        operations: { cutting: data.cutting, edging: data.edging, cnc: Boolean(data.cnc) },
        title: data.title || undefined,
        clientNotes: data.clientNotes || undefined,
        internalNotes: data.internalNotes || undefined,
      },
    },
    { returnDocument: "after" },
  );
  if (!job) throw new ServiceError("CONFLICT", "Only draft jobs can be edited.");
  // Keep the later stages in step with the job (a draft has not started).
  for (const [stage, wanted] of [["CNC", Boolean(data.cnc)], ["EDGING", data.edging]] as const) {
    if (wanted) {
      await ProductionTask.updateOne({ jobId: job._id, stage }, { $setOnInsert: { workNumber: job.workNumber, status: "BLOCKED" } }, { upsert: true });
    } else {
      await ProductionTask.deleteOne({ jobId: job._id, stage, status: "BLOCKED" });
    }
  }
  await audit({ actorId: actor.id, action: "job.updated", targetType: "Job", targetId: job._id });
  return job;
}

export type JobRow = {
  _id: Types.ObjectId;
  workNumber: string;
  title?: string;
  status: JobStatus;
  operations: { cutting: boolean; edging: boolean; cnc?: boolean | null };
  createdAt: Date;
  client: { _id: Types.ObjectId; clientNumber: string; businessName?: string; name: string };
};

export async function listJobs({ q = "", status = "", clientId = "", page = 1 } = {}) {
  await connectDb();
  const pre: Record<string, unknown> = {};
  if (status) pre.status = status;
  if (clientId && mongoose.isValidObjectId(clientId)) pre.clientId = new mongoose.Types.ObjectId(clientId);

  const term = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = term ? new RegExp(term, "i") : null;

  const [result] = await Job.aggregate<{ rows: JobRow[]; total: Array<{ n: number }> }>([
    { $match: pre },
    { $lookup: { from: "clientprofiles", localField: "clientId", foreignField: "_id", as: "profile" } },
    { $unwind: "$profile" },
    { $lookup: { from: "users", localField: "profile.userId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    ...(re
      ? [{ $match: { $or: [{ workNumber: re }, { title: re }, { "profile.clientNumber": re }, { "profile.businessName": re }, { "user.name": re }] } }]
      : []),
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        rows: [
          { $skip: (page - 1) * PAGE_SIZE },
          { $limit: PAGE_SIZE },
          {
            $project: {
              workNumber: 1,
              title: 1,
              status: 1,
              operations: 1,
              createdAt: 1,
              client: {
                _id: "$profile._id",
                clientNumber: "$profile.clientNumber",
                businessName: "$profile.businessName",
                name: "$user.name",
              },
            },
          },
        ],
        total: [{ $count: "n" }],
      },
    },
  ]);
  const total = result?.total[0]?.n ?? 0;
  return { rows: result?.rows ?? [], total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getJobByWorkNumber(workNumber: string) {
  await connectDb();
  const job = await Job.findOne({ workNumber }).lean();
  if (!job) return null;
  const profile = await ClientProfile.findById(job.clientId).lean();
  const user = profile && (await User.findById(profile.userId).select("name phone email").lean());
  return { job, profile, clientUser: user };
}

/**
 * Staff confirm the boards for a job are in the workshop. An approved job
 * joins the cutting queue at once; a draft simply records it, and goes
 * straight to the queue when its cutlist is approved.
 */
export async function confirmMaterials(actor: Actor, workNumber: string) {
  assertStaff(actor);
  await connectDb();
  const job = await Job.findOne({ workNumber });
  if (!job) throw new ServiceError("NOT_FOUND", "Job not found.");
  if (job.materialConfirmedAt) throw new ServiceError("CONFLICT", "Materials are already confirmed for this job.");
  const set = { materialConfirmedAt: new Date(), materialConfirmedBy: new mongoose.Types.ObjectId(actor.id) };
  const event = { type: "MATERIAL_CONFIRMED", actorId: actor.id, note: "Materials available" };

  await mongoose.connection.transaction(async (session) => {
    if (job.status === "AWAITING_MATERIAL") {
      await queueForCutting(job, "AWAITING_MATERIAL", event, session, set);
    } else if (job.status === "DRAFT") {
      const r = await Job.updateOne({ _id: job._id, status: "DRAFT", materialConfirmedAt: null }, { $set: set }, { session });
      if (r.modifiedCount !== 1) throw new ServiceError("CONFLICT", "The job changed while you were working. Reload and try again.");
      await recordJobEvent(job._id, event, session);
    } else {
      throw new ServiceError("CONFLICT", "Materials can only be confirmed before production starts.");
    }
  });
  await audit({ actorId: actor.id, action: "job.material_confirmed", targetType: "Job", targetId: job._id });
}

/**
 * Records the boards for a job: what material, how many sheets, who supplied
 * them. Replaces the whole list; it can be changed at any time, and each save
 * is on the timeline.
 */
export async function saveJobMaterials(actor: Actor, workNumber: string, raw: unknown) {
  assertStaff(actor);
  const parsed = jobMaterialsSchema.safeParse(raw);
  if (!parsed.success) throw new ServiceError("INVALID", parsed.error.issues[0]?.message ?? "Check the materials.");
  const items = parsed.data.map((m) => ({ ...m, materialId: m.materialId && mongoose.isValidObjectId(m.materialId) ? m.materialId : undefined, note: m.note || undefined }));
  await connectDb();
  const job = await Job.findOne({ workNumber }).select("_id status").lean();
  if (!job) throw new ServiceError("NOT_FOUND", "Job not found.");
  if (job.status === "CANCELLED") throw new ServiceError("CONFLICT", "This job is cancelled.");
  const sheets = items.reduce((n, m) => n + m.sheets, 0);
  await mongoose.connection.transaction(async (session) => {
    await Job.updateOne({ _id: job._id }, { $set: { materials: items } }, { session });
    await recordJobEvent(
      job._id,
      { type: "MATERIAL_DETAILS", actorId: actor.id, note: items.length ? `Materials recorded: ${items.map((m) => `${describeMaterial(m)} × ${m.sheets}`).join(", ")}` : "Material list cleared", clientVisible: false },
      session,
    );
  });
  await audit({ actorId: actor.id, action: "job.materials_recorded", targetType: "Job", targetId: job._id, meta: { workNumber, lines: items.length, sheets } });
}

/** Undo a confirmation made in error. A queued job leaves the queue (keeping its place for later). */
export async function withdrawMaterials(actor: Actor, workNumber: string, reason: string) {
  assertStaff(actor);
  const why = reason.trim();
  if (why.length < 3) throw new ServiceError("INVALID", "Give a reason.");
  await connectDb();
  const job = await Job.findOne({ workNumber });
  if (!job) throw new ServiceError("NOT_FOUND", "Job not found.");
  if (!job.materialConfirmedAt) throw new ServiceError("CONFLICT", "Materials are not confirmed for this job.");
  const set = { materialConfirmedAt: null, materialConfirmedBy: null };
  const event = { type: "MATERIAL_WITHDRAWN", actorId: actor.id, reason: why.slice(0, 500) };

  await mongoose.connection.transaction(async (session) => {
    if (job.status === "QUEUED_FOR_CUTTING") {
      await transitionJob(job._id, "QUEUED_FOR_CUTTING", "AWAITING_MATERIAL", event, session, set);
      await leaveCuttingQueue(job._id, session);
    } else if (job.status === "DRAFT") {
      const r = await Job.updateOne({ _id: job._id, status: "DRAFT" }, { $set: set }, { session });
      if (r.modifiedCount !== 1) throw new ServiceError("CONFLICT", "The job changed while you were working. Reload and try again.");
      await recordJobEvent(job._id, event, session);
    } else {
      throw new ServiceError("CONFLICT", "Materials can only be withdrawn before production starts.");
    }
  });
  await audit({ actorId: actor.id, action: "job.material_withdrawn", targetType: "Job", targetId: job._id, meta: { reason: why } });
}
