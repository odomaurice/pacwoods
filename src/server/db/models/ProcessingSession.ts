import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const SESSION_END_REASONS = ["PAUSE", "COMPLETE", "REASSIGN"] as const;

/**
 * A stretch of actual work on a task, from start/resume to pause/complete.
 * Active time is the sum of sessions; gaps between them are paused time.
 */
const processingSessionSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "ProductionTask", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    operatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    endReason: { type: String, enum: SESSION_END_REASONS },
    note: { type: String, maxlength: 500 },
  },
  { versionKey: false },
);

processingSessionSchema.index({ taskId: 1, startedAt: 1 });
processingSessionSchema.index({ operatorId: 1, startedAt: -1 });

export type ProcessingSessionDoc = InferSchemaType<typeof processingSessionSchema>;

export const ProcessingSession: Model<ProcessingSessionDoc> =
  (mongoose.models.ProcessingSession as Model<ProcessingSessionDoc>) ??
  mongoose.model("ProcessingSession", processingSessionSchema);
