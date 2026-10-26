export const PHOTO_KINDS = ["MATERIAL", "FINISHED"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const PHOTO_KIND_LABELS: Record<PhotoKind, string> = {
  MATERIAL: "Wood received",
  FINISHED: "Finished work",
};

/** Per job (material) or per production stage (finished). */
export const MAX_PHOTOS = 12;
/** Upload limit after the browser has shrunk the picture. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
