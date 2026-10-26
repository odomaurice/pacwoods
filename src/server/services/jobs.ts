import "server-only";
import { randomBytes } from "node:crypto";
import mongoose, { type Types } from "mongoose";
import type { JobStatus } from "@/lib/jobs";
import { jobDetailsSchema, jobSchema, type JobDetailsInput, type JobInput } from "@/lib/schemas";
import { formatWorkNumber, workNumberCounter } from "@/lib/numbers";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { nextSequence } from "@/server/db/models/Counter";
import { Job } from "@/server/db/models/Job";
import { User } from "@/server/db/models/User";
import { audit } from "@/server/services/audit";
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
          operations: { cutting: data.cutting, edging: data.edging },
          title: data.title || undefined,
          clientNotes: data.clientNotes || undefined,
          internalNotes: data.internalNotes || undefined,
          qrToken: randomBytes(16).toString("base64url"),
          createdBy: actor.id,
        },
      ],
      { session },
    );
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
        operations: { cutting: data.cutting, edging: data.edging },
        title: data.title || undefined,
        clientNotes: data.clientNotes || undefined,
        internalNotes: data.internalNotes || undefined,
      },
    },
    { returnDocument: "after" },
  );
  if (!job) throw new ServiceError("CONFLICT", "Only draft jobs can be edited.");
  await audit({ actorId: actor.id, action: "job.updated", targetType: "Job", targetId: job._id });
  return job;
}

export type JobRow = {
  _id: Types.ObjectId;
  workNumber: string;
  title?: string;
  status: JobStatus;
  operations: { cutting: boolean; edging: boolean };
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
