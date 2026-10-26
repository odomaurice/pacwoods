import Link from "next/link";
import { cn } from "@/lib/utils";

/** A headline number that opens the list behind it. */
export default function StatTile({ label, value, href, hint, alert = false }: { label: string; value: number; href: string; hint?: string; alert?: boolean }) {
  return (
    <Link href={href} className={cn("group rounded-lg bg-card p-4 transition-colors hover:bg-accent", alert && value > 0 && "bg-destructive/5")}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-3xl font-semibold tabular-nums", alert && value > 0 && "text-destructive")}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground group-hover:text-foreground">{hint} →</p>}
    </Link>
  );
}
