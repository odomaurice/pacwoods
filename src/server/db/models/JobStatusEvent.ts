import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/server/db/model";
import { JOB_STATUSES } from "@/lib/jobs";

/** Append-only job timeline. Written only by the workflow module. */
const jobStatusEventSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    type: { type: String, required: true },
    from: { type: String, enum: JOB_STATUSES },
    to: { type: String, enum: JOB_STATUSES },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    note: { type: String, maxlength: 1000 },
    reason: { type: String, maxlength: 500 },
    /** Whether the client sees this entry on their timeline. */
    clientVisible: { type: Boolean, default: true },
    at: { type: Date, default: () => new Date(), immutable: true },
  },
  { versionKey: false },
);

jobStatusEventSchema.index({ jobId: 1, at: 1 });

export type JobStatusEventDoc = InferSchemaType<typeof jobStatusEventSchema>;

export const JobStatusEvent: Model<JobStatusEventDoc> =
  defineModel<JobStatusEventDoc>("JobStatusEvent", jobStatusEventSchema);
