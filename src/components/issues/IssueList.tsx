import { Badge } from "@/components/ui/badge";
import ViewButton from "@/components/ViewButton";
import { ISSUE_CATEGORY_LABELS, type IssueCategory, type IssueStatus } from "@/lib/issues";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

type Row = {
  _id: { toString(): string };
  category: IssueCategory;
  description: string;
  status: IssueStatus;
  createdAt: Date;
  resolution?: string | null;
  resolvedAt?: Date | null;
  reporterName?: string;
};

/** Issues on one job: staff get a View link, clients see the resolution note. */
export default function IssueList({ rows, staff }: { rows: Row[]; staff: boolean }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r._id.toString()} className="rounded-lg bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{ISSUE_CATEGORY_LABELS[r.category]}</span>
            <Badge variant={r.status === "OPEN" ? "destructive" : "outline"}>{r.status === "OPEN" ? "Open" : "Resolved"}</Badge>
            <span className="text-sm text-muted-foreground">
              {dateFormat.format(r.createdAt)}
              {staff && r.reporterName && ` · ${r.reporterName}`}
            </span>
            {staff && (
              <span className="ml-auto">
                <ViewButton href={`/admin/issues/${r._id}`} label="View issue" />
              </span>
            )}
          </div>
          <p className="mt-2 text-sm whitespace-pre-line">{r.description}</p>
          {r.status === "RESOLVED" && r.resolution && (
            <p className="mt-2 rounded-md bg-muted p-3 text-sm">
              <span className="font-medium">Resolved{r.resolvedAt ? ` ${dateFormat.format(r.resolvedAt)}` : ""}: </span>
              {r.resolution}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
