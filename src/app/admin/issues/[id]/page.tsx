import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Detail from "@/components/Detail";
import { ResolveIssueButton } from "@/components/issues/IssueButtons";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ISSUE_CATEGORY_LABELS } from "@/lib/issues";
import { requireRole } from "@/server/auth/guards";
import { getIssue } from "@/server/services/issues";

export const metadata: Metadata = { title: "Issue | Pacwoods" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function IssuePage({ params }: PageProps<"/admin/issues/[id]">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { id } = await params;
  const found = await getIssue(id);
  if (!found) notFound();
  const { issue, reporter, resolver } = found;

  return (
    <>
      <Link href="/admin/issues" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Issues
      </Link>
      <PageHeader
        title={ISSUE_CATEGORY_LABELS[issue.category]}
        description={`On ${issue.workNumber} · reported ${dateFormat.format(issue.createdAt)}`}
        actions={
          <>
            <Link href={`/admin/jobs/${issue.workNumber}`} className={buttonVariants({ variant: "outline" })}>
              Open job
            </Link>
            {issue.taskId && (
              <Link href={`/admin/tasks/${issue.taskId}`} className={buttonVariants({ variant: "outline" })}>
                Open production stage
              </Link>
            )}
            {issue.status === "OPEN" && <ResolveIssueButton issueId={issue._id.toString()} workNumber={issue.workNumber} />}
          </>
        }
      />

      <dl className="mb-6 grid gap-4 rounded-lg bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Status">
          <Badge variant={issue.status === "OPEN" ? "destructive" : "outline"}>{issue.status === "OPEN" ? "Open" : "Resolved"}</Badge>
        </Detail>
        <Detail label="Reported by">
          {reporter?.name ?? "Unknown"} <span className="text-sm font-normal text-muted-foreground">({issue.reporterRole === "CLIENT" ? "client" : "operator"})</span>
        </Detail>
        <Detail label="Contact">
          {reporter?.phone ? (
            <a href={`tel:${reporter.phone}`} className="underline-offset-4 hover:underline">
              {reporter.phone}
            </a>
          ) : (
            (reporter?.email ?? "—")
          )}
        </Detail>
      </dl>

      <section className="mb-6 rounded-lg bg-card p-5">
        <h2 className="mb-2 font-semibold">What was reported</h2>
        <p className="whitespace-pre-line">{issue.description}</p>
      </section>

      {issue.status === "RESOLVED" && (
        <section className="rounded-lg bg-muted p-5">
          <h2 className="mb-1 font-semibold">Resolution</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            {resolver?.name ?? "Staff"} · {issue.resolvedAt ? dateFormat.format(issue.resolvedAt) : ""}
          </p>
          <p className="whitespace-pre-line">{issue.resolution}</p>
        </section>
      )}
    </>
  );
}
