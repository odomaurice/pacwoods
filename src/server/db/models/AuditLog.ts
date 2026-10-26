import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Append-only record of sensitive actions. Never store secrets in `meta`. */
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    targetType: { type: String },
    targetId: { type: Schema.Types.ObjectId },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String },
    at: { type: Date, default: () => new Date(), immutable: true },
  },
  { versionKey: false },
);

auditLogSchema.index({ targetId: 1, at: -1 });
auditLogSchema.index({ actorId: 1, at: -1 });
auditLogSchema.index({ action: 1, at: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;

export const AuditLog: Model<AuditLogDoc> =
  (mongoose.models.AuditLog as Model<AuditLogDoc>) ??
  mongoose.model("AuditLog", auditLogSchema);
