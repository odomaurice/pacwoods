import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** The "View" call to action at the end of every table row. */
export default function ViewButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className={buttonVariants({ size: "sm" })}>
      View
    </Link>
  );
}
