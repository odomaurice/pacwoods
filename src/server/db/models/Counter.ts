import { Schema, type ClientSession, type Model } from "mongoose";
import { defineModel } from "@/server/db/model";

/** Named monotonic sequences (`job:2026`, `client`), bumped atomically. */
const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const Counter: Model<{ _id: string; seq: number }> =
  defineModel<{ _id: string; seq: number }>("Counter", counterSchema);

/** Returns the next value of `name`, starting at 1. Safe under concurrency. */
export async function nextSequence(name: string, session?: ClientSession): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", lean: true, session },
  );
  return doc!.seq;
}
