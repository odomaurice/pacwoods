import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { Pagination, listParams, withParams } from "@/components/ListControls";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ViewButton from "@/components/ViewButton";
import { ISSUE_CATEGORY_LABELS } from "@/lib/issues";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { listIssues } from "@/server/services/issues";

export const metadata: Metadata = { title: "Issues | Pacwoods" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const TABS = [
  { key: "OPEN", label: "Open" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "ALL", label: "All" },
] as const;

export default async function IssuesPage({ searchParams }: PageProps<"/admin/issues">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const sp = await searchParams;
  const { page, one } = listParams(sp);
  const status = (TABS.find((t) => t.key === one(sp.status))?.key ?? "OPEN") as (typeof TABS)[number]["key"];
  const { rows, total, pages } = await listIssues({ status, page });

  return (
    <>
      <PageHeader title="Issues" description="Problems reported by operators and clients. Resolve each one with a note the reporter can read." />
      <nav aria-label="Filter issues" className="mb-4 flex gap-1 rounded-lg bg-card p-1 sm:w-fit">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={withParams("/admin/issues", { status: t.key === "OPEN" ? undefined : t.key })}
            aria-current={status === t.key ? "page" : undefined}
            className={cn("flex-1 rounded-md px-4 py-2 text-center text-sm font-medium", status === t.key ? "bg-brand-charcoal text-white" : "hover:bg-muted")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title={status === "OPEN" ? "No open issues." : "No issues here."} />
      ) : (
        <div className="rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reported</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r._id.toString()}>
                  <TableCell className="whitespace-nowrap">{dateFormat.format(r.createdAt)}</TableCell>
                  <TableCell className="font-mono">{r.workNumber}</TableCell>
                  <TableCell>
                    {r.reporterName}
                    <span className="block text-xs text-muted-foreground">{r.reporterRole === "CLIENT" ? "Client" : "Operator"}</span>
                  </TableCell>
                  <TableCell className="max-w-sm">
                    <span className="font-medium">{ISSUE_CATEGORY_LABELS[r.category]}</span>
                    <span className="block truncate text-sm text-muted-foreground">{r.description}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "OPEN" ? "destructive" : "outline"}>{r.status === "OPEN" ? "Open" : "Resolved"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ViewButton href={`/admin/issues/${r._id}`} label={`View issue on ${r.workNumber}`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={page} pages={pages} total={total} href={(p) => withParams("/admin/issues", { status: status === "OPEN" ? undefined : status, page: p })} />
    </>
  );
}
