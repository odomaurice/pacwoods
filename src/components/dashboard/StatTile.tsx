import Link from "next/link";
import { cn } from "@/lib/utils";

/** A headline number that opens the list behind it. */
export default function StatTile({ label, value, href, hint, alert = false }: { label: string; value: number; href: string; hint?: string; alert?: boolean }) {
  return (
    <Link href={href} className={cn("group panel p-5 transition-shadow hover:shadow-[var(--shadow-card-hover)]", alert && value > 0 && "bg-destructive/5")}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-4xl font-semibold tracking-tight tabular-nums", alert && value > 0 && "text-destructive")}>{value}</p>
      {hint && <p className="mt-2 text-xs font-medium text-muted-foreground group-hover:text-foreground">{hint} →</p>}
    </Link>
  );
}
