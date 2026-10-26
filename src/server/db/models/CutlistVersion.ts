import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { CutlistOptions, CutlistPart, CutlistStock } from "@/lib/cutlist";
import type { Plan } from "@/lib/cutting/types";

export const CUTLIST_STATES = ["DRAFT", "APPROVED", "SUPERSEDED"] as const;
export type CutlistState = (typeof CUTLIST_STATES)[number];

/** A stored panel row, with a snapshot of its material at the time. */
export type StoredPart = CutlistPart & { materialName?: string; thicknessMm?: number };
export type StoredStock = CutlistStock & { materialName?: string; thicknessMm?: number };

export type CutlistVersionDoc = {
  jobId: Types.ObjectId;
  version: number;
  state: CutlistState;
  parts: StoredPart[];
  stockSheets: StoredStock[];
  options: CutlistOptions;
  /** The engine's output, exactly as calculated. Null until generated. */
  plan: Plan | null;
  /** Hash of the inputs the plan was generated from; stale when it differs. */
  planInputHash?: string;
  planGeneratedAt?: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  revisionReason?: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * One version of a job's cutlist. Approved versions are never edited; a
 * revision creates the next version. Rows are schemaless here because the Zod
 * schema in lib/cutlist validates them on every write.
 */
const cutlistVersionSchema = new Schema<CutlistVersionDoc>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    version: { type: Number, required: true },
    state: { type: String, enum: CUTLIST_STATES, default: "DRAFT" },
    parts: { type: Schema.Types.Mixed, default: [] },
    stockSheets: { type: Schema.Types.Mixed, default: [] },
    options: { type: Schema.Types.Mixed, required: true },
    plan: { type: Schema.Types.Mixed, default: null },
    planInputHash: { type: String },
    planGeneratedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    revisionReason: { type: String, maxlength: 500 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, minimize: false },
);

cutlistVersionSchema.index({ jobId: 1, version: 1 }, { unique: true });
// At most one draft per job.
cutlistVersionSchema.index({ jobId: 1 }, { unique: true, partialFilterExpression: { state: "DRAFT" }, name: "one_draft_per_job" });

export const CutlistVersion: Model<CutlistVersionDoc> =
  (mongoose.models.CutlistVersion as Model<CutlistVersionDoc>) ??
  mongoose.model<CutlistVersionDoc>("CutlistVersion", cutlistVersionSchema);
