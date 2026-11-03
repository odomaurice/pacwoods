import { isOffline, reportOffline } from "@/lib/offline/connectivity";
import { queuePhoto } from "@/lib/offline/outbox";

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

/** Uploaded; kept on this device until the connection returns; or refused. */
export type UploadOutcome = { status: "uploaded" } | { status: "queued" } | { status: "failed"; error: string };

/**
 * Uploads one photo to a job. `onProgress` gets 0–100: fetch cannot report
 * upload progress, so this uses XMLHttpRequest. 100 is reported only once the
 * server has stored it. Without a connection the photo goes to the outbox
 * (src/lib/offline/outbox.ts) and is sent later under the same reference, so
 * the server never keeps it twice.
 */
export async function uploadPhoto(
  file: File,
  fields: { workNumber: string; kind: "MATERIAL" | "FINISHED"; taskId?: string },
  onProgress?: (percent: number) => void,
): Promise<UploadOutcome> {
  onProgress?.(0);
  const blob = await shrinkForUpload(file);
  const clientRef = crypto.randomUUID();
  const queue = async (): Promise<UploadOutcome> => {
    try {
      await queuePhoto(clientRef, { ...fields, blob });
      return { status: "queued" };
    } catch {
      return { status: "failed", error: "The photo could not be uploaded. Check the connection and try again." };
    }
  };
  if (isOffline() || !navigator.onLine) return queue();

  const body = new FormData();
  body.set("file", blob, "photo.jpg");
  body.set("workNumber", fields.workNumber);
  body.set("kind", fields.kind);
  body.set("clientRef", clientRef);
  if (fields.taskId) body.set("taskId", fields.taskId);

  const sent = await new Promise<UploadOutcome | "network">((resolve) => {
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
        resolve({ status: "uploaded" });
        return;
      }
      let error: string | undefined;
      try {
        error = (JSON.parse(xhr.responseText) as { error?: string }).error;
      } catch {}
      resolve({ status: "failed", error: error ?? "The photo could not be uploaded." });
    };
    xhr.onerror = () => resolve("network");
    xhr.send(body);
  });
  if (sent !== "network") return sent;
  reportOffline();
  return queue();
}
