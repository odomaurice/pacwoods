import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/server/db/model";
import { ISSUE_CATEGORIES, ISSUE_STATUSES } from "@/lib/issues";

/** A problem raised on a job by an operator or a client, until staff resolve it. */
const issueSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    workNumber: { type: String, required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "ProductionTask" },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reporterRole: { type: String, enum: ["OPERATOR", "CLIENT"], required: true },
    category: { type: String, enum: ISSUE_CATEGORIES, required: true },
    description: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: ISSUE_STATUSES, default: "OPEN" },
    resolution: { type: String, maxlength: 1000 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

issueSchema.index({ status: 1, createdAt: -1 });
issueSchema.index({ jobId: 1, createdAt: -1 });
issueSchema.index({ reportedBy: 1, createdAt: -1 });

export type IssueDoc = InferSchemaType<typeof issueSchema>;

export const Issue: Model<IssueDoc> = defineModel<IssueDoc>("Issue", issueSchema);
