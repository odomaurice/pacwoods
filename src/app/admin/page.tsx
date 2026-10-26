import type { Metadata } from "next";
import Link from "next/link";
import { JobsPerDayChart, JobsSunburst, SheetsByMaterialChart, WorkloadChart } from "@/components/dashboard/Charts";
import StatTile from "@/components/dashboard/StatTile";
import JobTable from "@/components/JobTable";
import PageHeader from "@/components/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { staffDashboard } from "@/server/services/dashboard";
import { listJobs } from "@/server/services/jobs";

export const metadata: Metadata = { title: "Overview | Pacwoods" };

/** Everything here is counted from the database at request time. */
export default async function AdminOverview() {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  const [d, recent] = await Promise.all([staffDashboard(), listJobs({ page: 1 })]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`Signed in as ${user.name}. Figures are live.`}
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Active jobs" value={d.kpis.active} href="/admin/jobs" hint="All jobs" />
        <StatTile label="In production" value={d.kpis.inProduction} href="/admin/queues" hint="Queues" />
        <StatTile label="Waiting in queues" value={d.kpis.waitingInQueues} href="/admin/queues" hint="Queues" />
        <StatTile label="Needs an operator" value={d.kpis.unassigned} href="/admin/queues" hint="Assign" alert />
        <StatTile label="Open issues" value={d.kpis.openIssues} href="/admin/issues" hint="Issues" alert />
        <StatTile label="Completed, 30 days" value={d.kpis.completed30} href="/admin/jobs?status=COMPLETED" hint="Completed" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <JobsSunburst byStatus={d.byStatus} />
        <JobsPerDayChart data={d.jobsPerDay} />
        <WorkloadChart data={d.workload} />
        <SheetsByMaterialChart data={d.sheetsByMaterial} />
      </div>

      {recent.rows.length > 0 && (
        <section aria-labelledby="recent" className="space-y-3">
          <h2 id="recent" className="text-lg font-semibold">
            Latest jobs
          </h2>
          <JobTable rows={recent.rows.slice(0, 5)} />
        </section>
      )}
    </div>
  );
}
