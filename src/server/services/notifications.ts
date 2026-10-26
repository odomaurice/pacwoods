import "server-only";
import mongoose, { type ClientSession, type Types } from "mongoose";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { Job } from "@/server/db/models/Job";
import { Notification } from "@/server/db/models/Notification";
import { User } from "@/server/db/models/User";

type Note = { title: string; body?: string; href?: string };

export async function notify(userIds: Array<string | Types.ObjectId>, note: Note, session?: ClientSession) {
  if (userIds.length === 0) return;
  await Notification.create(
    userIds.map((userId) => ({ userId, ...note })),
    { session, ordered: true },
  );
}

/** What a client is told for each job event they care about. */
const CLIENT_MESSAGES: Record<string, (wn: string) => string> = {
  CUTLIST_APPROVED: (wn) => `The cutlist for ${wn} is approved.`,
  MATERIAL_CONFIRMED: (wn) => `The wood for ${wn} is in the workshop.`,
  CUTTING_STARTED: (wn) => `Cutting has started on ${wn}.`,
  CUTTING_COMPLETED: (wn) => `Cutting is finished on ${wn}.`,
  EDGING_STARTED: (wn) => `Edging has started on ${wn}.`,
  EDGING_COMPLETED: (wn) => `Edging is finished on ${wn}.`,
  JOB_COMPLETED: (wn) => `${wn} is complete and ready for collection.`,
};

/**
 * Called for every job timeline event, inside the same transaction. Clients
 * hear about progress on their own jobs; staff hear about reported problems.
 */
export async function notifyForJobEvent(jobId: Types.ObjectId, type: string, clientVisible: boolean, session?: ClientSession) {
  if (type === "ISSUE_REPORTED") {
    const job = await Job.findById(jobId).select("workNumber").session(session ?? null).lean();
    const staff = await User.find({ role: { $in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE" }).select("_id").session(session ?? null).lean();
    await notify(staff.map((s) => s._id), { title: `Problem reported on ${job?.workNumber ?? "a job"}`, href: "/admin/issues" }, session);
    return;
  }
  const message = CLIENT_MESSAGES[type];
  if (!message || !clientVisible) return;
  // One round trip: the job's work number and its client's user id.
  const [row] = await Job.aggregate<{ workNumber: string; userId: Types.ObjectId }>([
    { $match: { _id: jobId } },
    { $lookup: { from: ClientProfile.collection.collectionName, localField: "clientId", foreignField: "_id", as: "p" } },
    { $unwind: "$p" },
    { $project: { workNumber: 1, userId: "$p.userId" } },
  ]).session(session ?? null);
  if (!row) return;
  await notify([row.userId], { title: message(row.workNumber), href: `/client/jobs/${row.workNumber}` }, session);
}

export async function unreadCount(userId: string) {
  await connectDb();
  return Notification.countDocuments({ userId, readAt: null });
}

export async function listNotifications(userId: string) {
  await connectDb();
  return Notification.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
}

export async function markAllRead(userId: string) {
  await connectDb();
  await Notification.updateMany({ userId: new mongoose.Types.ObjectId(userId), readAt: null }, { $set: { readAt: new Date() } });
}
