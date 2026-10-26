"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import ConfirmAction from "@/components/ConfirmAction";
import { Button } from "@/components/ui/button";
import { uploadPhoto } from "@/lib/image-resize";

/** Take or choose photos (several at once); each is shrunk, then uploaded. */
export function PhotoUploader({
  workNumber,
  kind,
  taskId,
  label,
  large = false,
}: {
  workNumber: string;
  kind: "MATERIAL" | "FINISHED";
  taskId?: string;
  label: string;
  large?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string>();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    let ok = 0;
    for (const [i, file] of [...files].entries()) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      const error = await uploadPhoto(file, { workNumber, kind, taskId });
      if (error) toast.error(error);
      else ok++;
    }
    setBusy(undefined);
    if (input.current) input.current.value = "";
    if (ok) {
      toast.success(ok === 1 ? "Photo added." : `${ok} photos added.`);
      router.refresh();
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        aria-label={label}
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button type="button" variant="outline" size={large ? "lg" : "sm"} className={large ? "h-12 px-5 text-base" : undefined} disabled={Boolean(busy)} onClick={() => input.current?.click()}>
        <HugeiconsIcon icon={Camera01Icon} className="size-4" />
        {busy ?? label}
      </Button>
    </>
  );
}

export type GridPhoto = { id: string; canDelete: boolean; uploader?: string; at: string };

/** Thumbnails that open the full photo; removable where allowed. */
export function PhotoGrid({ photos, emptyText }: { photos: GridPhoto[]; emptyText: string }) {
  const router = useRouter();
  if (photos.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {photos.map((p) => (
        <li key={p.id} className="group relative overflow-hidden rounded-md bg-muted">
          <a href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer" aria-label={`Open photo${p.uploader ? ` by ${p.uploader}` : ""}`}>
            {/* Auth-protected and per-user, so a plain img rather than next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${p.id}?size=thumb`} alt="" loading="lazy" className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
          </a>
          {p.canDelete && (
            <div className="absolute top-1 right-1">
              <ConfirmAction
                label="Remove"
                destructive
                title="Remove this photo?"
                description="It is deleted for everyone."
                confirmLabel="Remove"
                onConfirm={async () => {
                  const res = await fetch(`/api/photos/${p.id}`, { method: "DELETE" });
                  if (!res.ok) {
                    toast.error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not remove it.");
                    return false;
                  }
                  toast.success("Photo removed.");
                  router.refresh();
                  return true;
                }}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
