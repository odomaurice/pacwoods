import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { STAGES, TASK_STATUSES } from "@/lib/production";

/**
 * One production stage of one job (cutting or edging). Status changes only
 * through the production service, with conditional updates.
 */
const productionTaskSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    workNumber: { type: String, required: true },
    stage: { type: String, enum: STAGES, required: true },
    status: { type: String, enum: TASK_STATUSES, required: true },
    /** FIFO position within the stage queue; issued by the server. */
    queueSeq: { type: Number },
    assignedOperatorId: { type: Schema.Types.ObjectId, ref: "User" },
    /** Set only while IN_PROGRESS: the operator working it. */
    activeOperatorId: { type: Schema.Types.ObjectId, ref: "User" },
    queuedAt: { type: Date },
    firstStartedAt: { type: Date },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    results: {
      quantityCompleted: { type: Number },
      wastePanels: { type: Number },
      defectivePanels: { type: Number },
      downtimeMin: { type: Number },
      notes: { type: String, maxlength: 1000 },
    },
  },
  { timestamps: true },
);

productionTaskSchema.index({ jobId: 1, stage: 1 }, { unique: true });
productionTaskSchema.index({ stage: 1, status: 1, queueSeq: 1 });
productionTaskSchema.index({ assignedOperatorId: 1, status: 1, queueSeq: 1 });
// An operator can have only one task in progress, enforced by the database.
productionTaskSchema.index(
  { activeOperatorId: 1 },
  { unique: true, partialFilterExpression: { activeOperatorId: { $type: "objectId" } }, name: "one_active_task_per_operator" },
);

export type ProductionTaskDoc = InferSchemaType<typeof productionTaskSchema>;

export const ProductionTask: Model<ProductionTaskDoc> =
  (mongoose.models.ProductionTask as Model<ProductionTaskDoc>) ?? mongoose.model("ProductionTask", productionTaskSchema);
