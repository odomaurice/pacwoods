/**
 * Shrinks a photo in the browser before upload: phone pictures are often
 * 5–10 MB, and 2000 px on the long side is plenty. Returns the original file
 * if the browser cannot decode it (the server then rejects it clearly).
 */
export async function shrinkForUpload(file: File, maxSide = 2000): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Uploads one photo to a job; resolves with an error message, or null on success. */
export async function uploadPhoto(file: File, fields: { workNumber: string; kind: "MATERIAL" | "FINISHED"; taskId?: string }) {
  const body = new FormData();
  body.set("file", await shrinkForUpload(file), "photo.jpg");
  body.set("workNumber", fields.workNumber);
  body.set("kind", fields.kind);
  if (fields.taskId) body.set("taskId", fields.taskId);
  const res = await fetch("/api/photos", { method: "POST", body });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "The photo could not be uploaded.";
}
