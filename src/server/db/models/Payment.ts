import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/server/db/model";
import { CLIENT_COVERAGE, PAYMENT_METHODS } from "@/lib/payments";
import { STAGES } from "@/lib/production";

/**
 * One payment made outside Pacwoods and recorded by staff: a client paying
 * for a job (part or full), or an operator being paid for a stage they
 * completed. Entries are never edited; a mistake is voided with a reason.
 */
const paymentSchema = new Schema(
  {
    kind: { type: String, enum: ["CLIENT", "OPERATOR"], required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    workNumber: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "ClientProfile", required: true },
    /** CLIENT entries: how much of the job this payment settles. */
    coverage: { type: String, enum: CLIENT_COVERAGE },
    /** OPERATOR entries: who was paid, for which stage. */
    operatorId: { type: Schema.Types.ObjectId, ref: "User" },
    taskId: { type: Schema.Types.ObjectId, ref: "ProductionTask" },
    stage: { type: String, enum: STAGES },
    /** Minor units (kobo, cents); optional because the figure is not always to hand. */
    amountMinor: { type: Number, min: 1 },
    method: { type: String, enum: PAYMENT_METHODS },
    note: { type: String, maxlength: 500 },
    paidAt: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Set on every entry and removed when it is voided, so indexes and totals see live entries only. */
    live: { type: Boolean },
    voidedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    voidReason: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

paymentSchema.index({ jobId: 1, kind: 1 });
paymentSchema.index({ clientId: 1, paidAt: -1 });
paymentSchema.index({ operatorId: 1, paidAt: -1 });
paymentSchema.index({ paidAt: -1 });
// A completed stage is paid once; voiding frees it to be recorded again.
paymentSchema.index({ taskId: 1 }, { unique: true, partialFilterExpression: { kind: "OPERATOR", live: true }, name: "one_live_payment_per_stage" });

export type PaymentDoc = InferSchemaType<typeof paymentSchema>;

export const Payment: Model<PaymentDoc> = defineModel<PaymentDoc>("Payment", paymentSchema);
