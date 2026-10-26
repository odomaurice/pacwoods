import type { ReactNode } from "react";

/** One labelled value inside a <dl> summary block. */
export default function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium break-words">{children}</dd>
    </div>
  );
}
