import "server-only";
import type { ClientSession, Types } from "mongoose";
import type { JobStatus } from "@/lib/jobs";
import { Job } from "@/server/db/models/Job";
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";
import { ServiceError } from "@/server/services/users";

/**
 * The job transitions that exist so far. Production states (queues, cutting,
 * edging) are added with the production phase; nothing else may set a status.
 */
const ALLOWED: Partial<Record<JobStatus, JobStatus[]>> = {
  DRAFT: ["AWAITING_MATERIAL", "CANCELLED"],
  AWAITING_MATERIAL: ["DRAFT", "CANCELLED"],
};

export function canTransition(from: JobStatus, to: JobStatus) {
  return ALLOWED[from]?.includes(to) ?? false;
}

type EventInfo = {
  type: string;
  actorId: string | Types.ObjectId;
  note?: string;
  reason?: string;
  clientVisible?: boolean;
};

/**
 * Moves a job from one status to another atomically: the update only matches
 * if the job is still in `from`, so two concurrent requests cannot both win.
 */
export async function transitionJob(
  jobId: Types.ObjectId,
  from: JobStatus,
  to: JobStatus,
  event: EventInfo,
  session?: ClientSession,
) {
  if (!canTransition(from, to)) throw new ServiceError("CONFLICT", `A job cannot go from ${from} to ${to}.`);
  const updated = await Job.findOneAndUpdate(
    { _id: jobId, status: from },
    { $set: { status: to } },
    { returnDocument: "after", session },
  );
  if (!updated) throw new ServiceError("CONFLICT", "The job changed while you were working. Reload and try again.");
  await JobStatusEvent.create([{ jobId, from, to, ...event }], { session });
  return updated;
}

/** A timeline entry that does not change status (creation, plan generated…). */
export async function recordJobEvent(jobId: Types.ObjectId, event: EventInfo, session?: ClientSession) {
  await JobStatusEvent.create([{ jobId, ...event }], { session });
}
