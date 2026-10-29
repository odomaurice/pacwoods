import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/server/db/model";
import { JOB_STATUSES } from "@/lib/jobs";
import { CLIENT_PAYMENT_STATUS } from "@/lib/payments";

/**
 * One client order. Parts, cutlists and production tasks hang off it in later
 * phases. `status` is written only by the job services, never from a form.
 */
const jobSchema = new Schema(
  {
    workNumber: { type: String, required: true, immutable: true },
    clientId: { type: Schema.Types.ObjectId, ref: "ClientProfile", required: true },
    operations: {
      cutting: { type: Boolean, required: true },
      edging: { type: Boolean, required: true },
    },
    status: { type: String, enum: JOB_STATUSES, default: "DRAFT" },
    title: { type: String, trim: true, maxlength: 160 },
    /** Visible to the client. */
    clientNotes: { type: String, trim: true, maxlength: 2000 },
    /** Staff only. */
    internalNotes: { type: String, trim: true, maxlength: 2000 },
    /** Opaque value printed in the QR code; reveals nothing about the job. */
    qrToken: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Set when staff confirm the boards are in the workshop. */
    materialConfirmedAt: { type: Date },
    materialConfirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    /**
     * Position in the cutting queue: a server-issued, ever-increasing number
     * assigned the first time the job enters the queue, and kept afterwards.
     */
    cuttingQueueSeq: { type: Number },
    /** Summary of the client's recorded payments (see Payment); missing on older jobs means UNPAID. */
    clientPayment: { type: String, enum: CLIENT_PAYMENT_STATUS, default: "UNPAID" },
  },
  { timestamps: true },
);

jobSchema.index({ workNumber: 1 }, { unique: true });
jobSchema.index({ qrToken: 1 }, { unique: true });
jobSchema.index({ clientId: 1, createdAt: -1 });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ cuttingQueueSeq: 1 }, { unique: true, partialFilterExpression: { cuttingQueueSeq: { $type: "number" } } });

export type JobDoc = InferSchemaType<typeof jobSchema>;

export const Job: Model<JobDoc> =
  defineModel<JobDoc>("Job", jobSchema);
