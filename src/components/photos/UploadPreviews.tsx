"use client";

import { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Tick02Icon, Alert02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/** Where one chosen photo is: not started, uploading (0–100), done or failed. */
export type UploadState = { percent?: number; done?: boolean; error?: boolean };

/** A local preview of a photo that has been chosen but is not on the server yet. */
function LocalThumb({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  // The object URL is released once the image has decoded; the pixels stay on screen.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" onLoad={() => URL.revokeObjectURL(url)} className="aspect-square w-full object-cover" />;
}

export default function UploadPreviews({
  files,
  states = [],
  onRemove,
  className,
}: {
  files: File[];
  states?: UploadState[];
  /** Offered only before uploading starts. */
  onRemove?: (index: number) => void;
  className?: string;
}) {
  return (
    <ul className={cn("grid grid-cols-4 gap-2 sm:grid-cols-6", className)}>
      {files.map((file, i) => {
        const s = states[i] ?? {};
        const uploading = s.percent !== undefined && !s.done && !s.error;
        return (
          <li key={`${file.name}-${file.lastModified}-${i}`} className="relative overflow-hidden rounded-md bg-muted">
            <LocalThumb file={file} />
            {(uploading || s.done || s.error) && (
              <div className={cn("absolute inset-0 flex items-center justify-center text-sm font-semibold text-white", s.error ? "bg-destructive/70" : s.done ? "bg-brand-charcoal/40" : "bg-brand-charcoal/60")}>
                {s.error ? (
                  <HugeiconsIcon icon={Alert02Icon} className="size-5" aria-label="Failed" />
                ) : s.done ? (
                  <HugeiconsIcon icon={Tick02Icon} className="size-5" aria-label="Uploaded" />
                ) : (
                  <span aria-live="polite">{s.percent}%</span>
                )}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30" role="progressbar" aria-valuenow={s.percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-brand-gold transition-[width]" style={{ width: `${s.percent}%` }} />
              </div>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${file.name}`}
                className="absolute top-1 right-1 flex size-6 cursor-pointer items-center justify-center rounded-full bg-brand-charcoal/75 text-white hover:bg-brand-charcoal"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
