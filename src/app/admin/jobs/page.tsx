import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import JobTable from "@/components/JobTable";
import { Pagination, SearchForm, listParams, withParams } from "@/components/ListControls";
import PageHeader from "@/components/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { JOB_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "@/lib/jobs";
import { requireRole } from "@/server/auth/guards";
import { listJobs } from "@/server/services/jobs";

export const metadata: Metadata = { title: "Jobs | Pacwoods" };

export default async function JobsPage({ searchParams }: PageProps<"/admin/jobs">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const sp = await searchParams;
  const { q, page, one } = listParams(sp);
  const status = (JOB_STATUSES as readonly string[]).includes(one(sp.status)) ? (one(sp.status) as JobStatus) : "";
  const { rows, total, pages } = await listJobs({ q, status, page });

  return (
    <>
      <PageHeader
        title="Jobs"
        actions={
          <Link href="/admin/jobs/new" className={buttonVariants()}>
            New job
          </Link>
        }
      />
      <SearchForm placeholder="Search by work number, title or client" q={q}>
        <select
          name="status"
          defaultValue={status}
          aria-label="Filter by status"
          className="h-10 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">All statuses</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {JOB_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </SearchForm>
      {rows.length === 0 ? (
        <EmptyState title={q || status ? "No jobs match these filters." : "No jobs yet."} />
      ) : (
        <JobTable rows={rows} />
      )}
      <Pagination page={page} pages={pages} total={total} href={(p) => withParams("/admin/jobs", { q, status, page: p })} />
    </>
  );
}
