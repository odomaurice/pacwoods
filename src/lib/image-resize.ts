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

/**
 * Uploads one photo to a job; resolves with an error message, or null on
 * success. `onProgress` gets 0–100: fetch cannot report upload progress, so
 * this uses XMLHttpRequest. 100 is reported only once the server has stored it.
 */
export async function uploadPhoto(
  file: File,
  fields: { workNumber: string; kind: "MATERIAL" | "FINISHED"; taskId?: string },
  onProgress?: (percent: number) => void,
): Promise<string | null> {
  onProgress?.(0);
  const body = new FormData();
  body.set("file", await shrinkForUpload(file), "photo.jpg");
  body.set("workNumber", fields.workNumber);
  body.set("kind", fields.kind);
  if (fields.taskId) body.set("taskId", fields.taskId);

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/photos");
    // The bytes going up are most of the wait; the last 5% is the server
    // re-encoding and storing the photo.
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.min(95, Math.round((e.loaded / e.total) * 95)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(null);
        return;
      }
      let error: string | undefined;
      try {
        error = (JSON.parse(xhr.responseText) as { error?: string }).error;
      } catch {}
      resolve(error ?? "The photo could not be uploaded.");
    };
    xhr.onerror = () => resolve("The photo could not be uploaded. Check the connection and try again.");
    xhr.send(body);
  });
}
