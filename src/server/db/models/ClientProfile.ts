import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/server/db/model";

const clientProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    clientNumber: { type: String, required: true },
    businessName: { type: String, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 500 },
    /** Staff only. Never sent to the client. */
    staffNotes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

clientProfileSchema.index({ clientNumber: 1 }, { unique: true });
clientProfileSchema.index({ userId: 1 }, { unique: true });

export type ClientProfileDoc = InferSchemaType<typeof clientProfileSchema>;

export const ClientProfile: Model<ClientProfileDoc> =
  defineModel<ClientProfileDoc>("ClientProfile", clientProfileSchema);
