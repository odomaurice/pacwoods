import "server-only";
import mongoose, { type Types } from "mongoose";
import sharp, { type OutputInfo } from "sharp";
import { MAX_PHOTOS, MAX_UPLOAD_BYTES, type PhotoKind } from "@/lib/photos";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { Job } from "@/server/db/models/Job";
import { Photo } from "@/server/db/models/Photo";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { audit } from "@/server/services/audit";
import { ServiceError } from "@/server/services/users";
import { deleteImage, putImage, readImage, type StoredImage } from "@/server/storage/images";
import { capabilitiesOf, operatorCanSee } from "@/server/services/production";
import { recordJobEvent } from "@/server/workflow/transitions";

type Viewer = { id: string; role: string };

const isStaff = (v: Viewer) => v.role === "SUPER_ADMIN" || v.role === "ADMIN";

/**
 * Who may see a job's photos: staff, its own client, and operators who can
 * see one of its stages (open and not taken by someone else, theirs, or
 * completed by them).
 */
export async function canViewJob(viewer: Viewer, jobId: Types.ObjectId) {
  if (isStaff(viewer)) return true;
  if (viewer.role === "OPERATOR") {
    const capabilities = await capabilitiesOf(viewer.id);
    const tasks = await ProductionTask.find({ jobId }).select("stage status assignedOperatorId completedBy").lean();
    return tasks.some((t) => operatorCanSee(t, { id: viewer.id, capabilities }));
  }
  if (viewer.role === "CLIENT") {
    const job = await Job.findById(jobId).select("clientId").lean();
    return Boolean(job && (await ClientProfile.exists({ _id: job.clientId, userId: viewer.id })));
  }
  return false;
}

function stored(photo: { storage: string; publicId?: string | null; version?: number | null; fileId?: Types.ObjectId | null; thumbId?: Types.ObjectId | null }): StoredImage {
  return photo.storage === "cloudinary"
    ? { storage: "cloudinary", publicId: photo.publicId!, version: photo.version! }
    : { storage: "gridfs", fileId: photo.fileId!, thumbId: photo.thumbId! };
}

/**
 * Saves one photo. Wood photos can be added by staff or the job's operators
 * until the job is finished; finished-work photos belong to a stage and can
 * be added by its operator (or staff) while that stage is open.
 */
export async function savePhoto(
  viewer: Viewer,
  input: { workNumber: string; kind: PhotoKind; taskId?: string; data: Buffer },
) {
  if (input.data.length === 0 || input.data.length > MAX_UPLOAD_BYTES) {
    throw new ServiceError("INVALID", "The photo is empty or larger than 10 MB.");
  }
  await connectDb();
  const job = await Job.findOne({ workNumber: input.workNumber }).select("_id workNumber status").lean();
  if (!job) throw new ServiceError("NOT_FOUND", "Job not found.");
  if (job.status === "COMPLETED" || job.status === "CANCELLED") throw new ServiceError("CONFLICT", "This job is closed; photos can no longer be added.");

  let taskId: Types.ObjectId | undefined;
  if (input.kind === "FINISHED") {
    if (!input.taskId || !mongoose.isValidObjectId(input.taskId)) throw new ServiceError("INVALID", "Finished-work photos belong to a production stage.");
    const task = await ProductionTask.findOne({ _id: input.taskId, jobId: job._id }).lean();
    if (!task) throw new ServiceError("NOT_FOUND", "Stage not found.");
    if (!isStaff(viewer) && task.assignedOperatorId?.toString() !== viewer.id) throw new ServiceError("FORBIDDEN", "Start this work first; finished-work photos come from the operator doing it.");
    if (task.status === "COMPLETED" || task.status === "CANCELLED") throw new ServiceError("CONFLICT", "This stage is already closed.");
    taskId = task._id;
  } else if (!isStaff(viewer)) {
    const onJob = viewer.role === "OPERATOR" && (await canViewJob(viewer, job._id));
    if (!onJob) throw new ServiceError("FORBIDDEN", "Only staff or operators who can work on this job can add photos.");
  }

  const count = await Photo.countDocuments({ jobId: job._id, kind: input.kind, ...(taskId ? { taskId } : {}) });
  if (count >= MAX_PHOTOS) throw new ServiceError("CONFLICT", `At most ${MAX_PHOTOS} photos here. Remove one first.`);

  // Re-encode: strips metadata (including location), fixes orientation, and
  // proves the upload really is an image.
  let full: { data: Buffer; info: OutputInfo };
  let thumb: Buffer;
  try {
    const image = sharp(input.data, { failOn: "error" }).rotate();
    full = await image.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    thumb = await image.clone().resize({ width: 480, height: 480, fit: "cover" }).webp({ quality: 70 }).toBuffer();
  } catch {
    throw new ServiceError("INVALID", "That file is not a picture we can read. Use a JPEG, PNG or WebP photo.");
  }

  const image = await putImage(full.data, thumb, `jobs/${job.workNumber}`);
  const photo = await Photo.create({
    jobId: job._id,
    workNumber: job.workNumber,
    taskId,
    kind: input.kind,
    ...image,
    width: full.info.width,
    height: full.info.height,
    bytes: full.data.length,
    uploadedBy: viewer.id,
    uploaderRole: viewer.role,
  });
  await recordJobEvent(job._id, {
    type: input.kind === "FINISHED" ? "FINISHED_PHOTO_ADDED" : "MATERIAL_PHOTO_ADDED",
    actorId: viewer.id,
    clientVisible: true,
  });
  return photo;
}

export async function listPhotos(jobId: Types.ObjectId) {
  await connectDb();
  return Photo.find({ jobId }).sort({ createdAt: 1 }).lean();
}

/** Streams a photo's bytes after checking the viewer may see its job. */
export async function openPhoto(viewer: Viewer, photoId: string, size: "full" | "thumb") {
  if (!mongoose.isValidObjectId(photoId)) return null;
  await connectDb();
  const photo = await Photo.findById(photoId).lean();
  if (!photo || !(await canViewJob(viewer, photo.jobId))) return null;
  return readImage(stored(photo), size);
}

/**
 * Removes a photo. Finished-work photos of a completed stage are the proof
 * of completion and stay.
 */
export async function deletePhoto(viewer: Viewer, photoId: string) {
  if (!mongoose.isValidObjectId(photoId)) throw new ServiceError("NOT_FOUND", "Photo not found.");
  await connectDb();
  const photo = await Photo.findById(photoId).lean();
  if (!photo) throw new ServiceError("NOT_FOUND", "Photo not found.");
  if (!isStaff(viewer) && photo.uploadedBy.toString() !== viewer.id) throw new ServiceError("FORBIDDEN", "You can only remove your own photos.");
  if (photo.taskId) {
    const task = await ProductionTask.findById(photo.taskId).select("status").lean();
    if (task?.status === "COMPLETED") throw new ServiceError("CONFLICT", "This photo is the record of completed work and cannot be removed.");
  }
  await Photo.deleteOne({ _id: photo._id });
  await deleteImage(stored(photo));
  await audit({ actorId: viewer.id, action: "photo.deleted", targetType: "Job", targetId: photo.jobId });
}
