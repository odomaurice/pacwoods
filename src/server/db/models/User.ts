import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CAPABILITIES, PERMISSIONS, ROLES } from "@/lib/roles";

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const userSchema = new Schema(
  {
    role: { type: String, enum: ROLES, required: true },
    permissions: { type: [String], enum: PERMISSIONS, default: [] },
    /** Operators only. */
    capabilities: { type: [String], enum: CAPABILITIES, default: [] },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    /** E.164. Optional, but every user needs a phone or an email. */
    phone: { type: String },
    /** Lower-cased. */
    email: { type: String },
    passwordHash: { type: String, required: true, select: false },
    mustChangePassword: { type: Boolean, default: true },
    status: { type: String, enum: USER_STATUSES, default: "ACTIVE" },
    /** Bumped to sign the user out everywhere; checked on every request. */
    sessionVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Unique only where present, so many phone-only clients can share "no email".
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
);
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
userSchema.index({ role: 1, status: 1 });

userSchema.pre("validate", function () {
  if (!this.phone && !this.email) {
    this.invalidate("phone", "A phone number or an email address is required.");
  }
});

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ?? mongoose.model("User", userSchema);
