import "server-only";
import { Readable } from "node:stream";
import mongoose, { type Types } from "mongoose";
import { v2 as cloudinary } from "cloudinary";

/**
 * Where photo bytes live. Cloudinary when CLOUDINARY_URL is set (production),
 * otherwise a GridFS bucket in the app's own database (development).
 *
 * Cloudinary images are uploaded as "authenticated", so they have no public
 * URL: the app fetches them with a signed URL on the server, after its own
 * permission check, and streams them to the viewer.
 */
export type StoredImage =
  | { storage: "cloudinary"; publicId: string; version: number }
  | { storage: "gridfs"; fileId: Types.ObjectId; thumbId: Types.ObjectId };

/**
 * Cloudinary is configured either by CLOUDINARY_URL
 * (cloudinary://API_KEY:API_SECRET@CLOUD_NAME), which the SDK reads itself,
 * or by the three separate CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET.
 */
let configured = false;
export function usingCloudinary() {
  if (process.env.CLOUDINARY_URL) return true;
  const { CLOUDINARY_CLOUD_NAME: cloud_name, CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = process.env;
  if (!cloud_name || !api_key || !api_secret) return false;
  if (!configured) {
    cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
    configured = true;
  }
  return true;
}

function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "photos" });
}

function toGridFs(data: Buffer, filename: string) {
  return new Promise<Types.ObjectId>((resolve, reject) => {
    const upload = bucket().openUploadStream(filename, { metadata: { contentType: "image/webp" } });
    upload.once("finish", () => resolve(upload.id as Types.ObjectId));
    upload.once("error", reject);
    upload.end(data);
  });
}

/** Stores a full-size WebP (and, for GridFS, a ready-made thumbnail). */
export async function putImage(full: Buffer, thumb: Buffer, folder: string): Promise<StoredImage> {
  if (usingCloudinary()) {
    const result = await new Promise<{ public_id: string; version: number }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ type: "authenticated", folder: `pacwoods/${folder}`, resource_type: "image", format: "webp" }, (error, res) =>
          error || !res ? reject(error ?? new Error("Upload failed")) : resolve(res),
        )
        .end(full);
    });
    return { storage: "cloudinary", publicId: result.public_id, version: result.version };
  }
  const [fileId, thumbId] = await Promise.all([toGridFs(full, `${folder}.webp`), toGridFs(thumb, `${folder}-thumb.webp`)]);
  return { storage: "gridfs", fileId, thumbId };
}

/** The image bytes as a web stream, or null if they are missing. */
export async function readImage(image: StoredImage, size: "full" | "thumb"): Promise<ReadableStream | null> {
  if (image.storage === "cloudinary") {
    usingCloudinary();
    const url = cloudinary.url(image.publicId, {
      type: "authenticated",
      sign_url: true,
      secure: true,
      version: image.version,
      format: "webp",
      transformation: size === "thumb" ? [{ width: 480, height: 480, crop: "fill", gravity: "auto" }] : [],
    });
    const res = await fetch(url);
    return res.ok && res.body ? res.body : null;
  }
  return Readable.toWeb(bucket().openDownloadStream(size === "thumb" ? image.thumbId : image.fileId)) as ReadableStream;
}

export async function deleteImage(image: StoredImage) {
  if (image.storage === "cloudinary") {
    usingCloudinary();
    await cloudinary.uploader.destroy(image.publicId, { type: "authenticated", invalidate: true }).catch(() => {});
    return;
  }
  await Promise.all([bucket().delete(image.fileId).catch(() => {}), bucket().delete(image.thumbId).catch(() => {})]);
}
