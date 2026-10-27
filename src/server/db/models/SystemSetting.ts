import { Schema, type Model } from "mongoose";
import { defineModel } from "@/server/db/model";

/** One document per settings group (currently just "workshop"). */
const systemSettingSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, minimize: false },
);

export type SystemSettingDoc = { _id: string; value: unknown; updatedBy?: unknown; updatedAt?: Date };

export const SystemSetting: Model<SystemSettingDoc> = defineModel<SystemSettingDoc>("SystemSetting", systemSettingSchema);
