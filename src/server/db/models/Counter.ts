import mongoose, { Schema, type Model } from "mongoose";

/** Named monotonic sequences (`job:2026`, `client`), bumped atomically. */
const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const Counter: Model<{ _id: string; seq: number }> =
  (mongoose.models.Counter as Model<{ _id: string; seq: number }>) ??
  mongoose.model("Counter", counterSchema);

/** Returns the next value of `name`, starting at 1. Safe under concurrency. */
export async function nextSequence(name: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", lean: true },
  );
  return doc!.seq;
}
