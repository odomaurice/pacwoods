import { Schema, type InferSchemaType, type Model } from "mongoose";
import { PHOTO_KINDS } from "@/lib/photos";
import { defineModel } from "@/server/db/model";

/**
 * A photo attached to a job: the wood as received, or the finished work of
 * one production stage. The bytes live in Cloudinary (private) or, in
 * development, a GridFS bucket; see src/server/storage/images.ts.
 */
const photoSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    workNumber: { type: String, required: true },
    /** Set for finished-work photos: the stage they prove complete. */
    taskId: { type: Schema.Types.ObjectId, ref: "ProductionTask" },
    kind: { type: String, enum: PHOTO_KINDS, required: true },
    storage: { type: String, enum: ["cloudinary", "gridfs"], required: true },
    publicId: { type: String },
    version: { type: Number },
    fileId: { type: Schema.Types.ObjectId },
    thumbId: { type: Schema.Types.ObjectId },
    width: { type: Number },
    height: { type: Number },
    bytes: { type: Number },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploaderRole: { type: String, required: true },
  },
  { timestamps: true },
);

photoSchema.index({ jobId: 1, kind: 1, createdAt: 1 });
photoSchema.index({ taskId: 1, kind: 1 });

export type PhotoDoc = InferSchemaType<typeof photoSchema>;

export const Photo: Model<PhotoDoc> = defineModel<PhotoDoc>("Photo", photoSchema);
