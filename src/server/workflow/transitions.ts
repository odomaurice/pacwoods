import "server-only";
import type { ClientSession, Types } from "mongoose";
import type { JobStatus } from "@/lib/jobs";
import { nextSequence } from "@/server/db/models/Counter";
import { Job } from "@/server/db/models/Job";
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";
import { ServiceError } from "@/server/services/users";

/**
 * The job transitions that exist so far. Production states (queues, cutting,
 * edging) are added with the production phase; nothing else may set a status.
 */
const ALLOWED: Partial<Record<JobStatus, JobStatus[]>> = {
  DRAFT: ["AWAITING_MATERIAL", "QUEUED_FOR_CUTTING", "CANCELLED"],
  AWAITING_MATERIAL: ["DRAFT", "QUEUED_FOR_CUTTING", "CANCELLED"],
  // Before an operator starts: reopen the cutlist, or withdraw the material.
  QUEUED_FOR_CUTTING: ["DRAFT", "AWAITING_MATERIAL", "CANCELLED"],
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
  /** Other fields written in the same atomic update. */
  set: Record<string, unknown> = {},
) {
  if (!canTransition(from, to)) throw new ServiceError("CONFLICT", `A job cannot go from ${from} to ${to}.`);
  const updated = await Job.findOneAndUpdate(
    { _id: jobId, status: from },
    { $set: { ...set, status: to } },
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

/**
 * Puts a job into the cutting queue. A job keeps the position it was first
 * given, so stepping out (material withdrawn, cutlist reopened) and back in
 * does not send it to the back of the queue.
 */
export async function queueForCutting(
  job: { _id: Types.ObjectId; cuttingQueueSeq?: number | null },
  from: JobStatus,
  event: EventInfo,
  session?: ClientSession,
  set: Record<string, unknown> = {},
) {
  const seq = job.cuttingQueueSeq ?? (await nextSequence("queue:cutting", session));
  return transitionJob(job._id, from, "QUEUED_FOR_CUTTING", event, session, { ...set, cuttingQueueSeq: seq });
}
