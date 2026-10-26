import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Fixed-window attempt counters; MongoDB's TTL monitor deletes old windows. */
const authThrottleSchema = new Schema(
  {
    key: { type: String, required: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

authThrottleSchema.index({ key: 1 }, { unique: true });
authThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AuthThrottleDoc = InferSchemaType<typeof authThrottleSchema>;

export const AuthThrottle: Model<AuthThrottleDoc> =
  (mongoose.models.AuthThrottle as Model<AuthThrottleDoc>) ??
  mongoose.model("AuthThrottle", authThrottleSchema);
