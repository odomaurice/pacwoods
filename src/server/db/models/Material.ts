import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { GRAINS } from "@/lib/schemas";

/** A sheet material in the catalogue. Dimensions are millimetres. */
const materialSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    thicknessMm: { type: Number, required: true, min: 0.1, max: 200 },
    grain: { type: String, enum: GRAINS, default: "NONE" },
    sheetLengthMm: { type: Number, required: true, min: 1, max: 10000 },
    sheetWidthMm: { type: Number, required: true, min: 1, max: 10000 },
    supplier: { type: String, trim: true, maxlength: 120 },
    /** Optional, in minor units of the (not yet decided) currency. */
    unitCost: { type: Number, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

materialSchema.index({ name: 1, thicknessMm: 1 }, { unique: true });
materialSchema.index({ active: 1, category: 1 });

export type MaterialDoc = InferSchemaType<typeof materialSchema>;

export const Material: Model<MaterialDoc> =
  (mongoose.models.Material as Model<MaterialDoc>) ?? mongoose.model("Material", materialSchema);
