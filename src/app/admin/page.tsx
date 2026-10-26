import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import JobTable from "@/components/JobTable";
import PageHeader from "@/components/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/jobs";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { requireRole } from "@/server/auth/guards";
import { connectDb } from "@/server/db/connect";
import { Job } from "@/server/db/models/Job";
import { User } from "@/server/db/models/User";
import { listJobs } from "@/server/services/jobs";

export const metadata: Metadata = { title: "Overview | Pacwoods" };

/** Everything here is counted from the database at request time. */
export default async function AdminOverview() {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");

  await connectDb();
  const [accountRows, jobRows, recent] = await Promise.all([
    User.aggregate<{ _id: Role; count: number }>([
      { $match: { status: "ACTIVE" } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
    Job.aggregate<{ _id: JobStatus; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    listJobs({ page: 1 }),
  ]);
  const accounts = Object.fromEntries(accountRows.map((r) => [r._id, r.count]));
  const visibleRoles = ROLES.filter((r) => user.role === "SUPER_ADMIN" || r !== "SUPER_ADMIN");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description={`Signed in as ${user.name}.`}
        actions={
          <>
            <Link href="/admin/clients/new" className={buttonVariants({ variant: "outline" })}>
              Register client
            </Link>
            <Link href="/admin/jobs/new" className={buttonVariants()}>
              New job
            </Link>
          </>
        }
      />

      <section aria-labelledby="jobs-by-status" className="space-y-3">
        <h2 id="jobs-by-status" className="text-lg font-semibold">
          Jobs by status
        </h2>
        {jobRows.length === 0 ? (
          <EmptyState title="No jobs yet." />
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {jobRows
              .sort((a, b) => b.count - a.count)
              .map((r) => (
                <Link key={r._id} href={`/admin/jobs?status=${r._id}`} className="rounded-lg bg-card px-4 py-3 hover:bg-accent">
                  <dt className="text-sm text-muted-foreground">{JOB_STATUS_LABELS[r._id]}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{r.count}</dd>
                </Link>
              ))}
          </dl>
        )}
      </section>

      {recent.rows.length > 0 && (
        <section aria-labelledby="recent" className="space-y-3">
          <h2 id="recent" className="text-lg font-semibold">
            Latest jobs
          </h2>
          <JobTable rows={recent.rows.slice(0, 5)} />
        </section>
      )}

      <section aria-labelledby="accounts" className="space-y-3">
        <h2 id="accounts" className="text-lg font-semibold">
          Active accounts
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visibleRoles.map((role) => (
            <div key={role} className="rounded-lg bg-card px-4 py-3">
              <dt className="text-sm text-muted-foreground">{ROLE_LABELS[role]}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{accounts[role] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
