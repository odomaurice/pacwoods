import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/button";

/** Excel and CSV download links for an export endpoint. */
export default function ExportButtons({ href, label = "Download" }: { href: string; label?: string }) {
  const join = href.includes("?") ? "&" : "?";
  return (
    <span className="inline-flex flex-wrap gap-2">
      <a href={`${href}${join}format=xlsx`} className={buttonVariants({ variant: "outline" })} download>
        <HugeiconsIcon icon={Download01Icon} className="size-4" />
        {label} Excel
      </a>
      <a href={`${href}${join}format=csv`} className={buttonVariants({ variant: "outline" })} download>
        CSV
      </a>
    </span>
  );
}
