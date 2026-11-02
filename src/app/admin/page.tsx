import type { Metadata } from "next";
import Link from "next/link";
import { JobsPerDayChart, JobsSunburst, SheetsByMaterialChart, WorkloadChart } from "@/components/dashboard/Charts";
import { ActivityFeed, CommandHeader, NeedsAttention, QueueSnapshots } from "@/components/dashboard/CommandCentre";
import NewJobSection from "@/components/jobs/NewJobSection";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { getSettings } from "@/server/services/settings";
import { commandCentre, staffDashboard } from "@/server/services/dashboard";
import { listJobs } from "@/server/services/jobs";

export const metadata: Metadata = { title: "Overview | Pacwoods" };

const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/**
 * The command centre. Everything here is counted from the database at
 * request time. Admins' main work is creating jobs, so for them the new-job
 * steps and their unfinished jobs come first; the Super Admin sees the
 * command centre alone.
 */
export default async function AdminOverview() {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  const creator = user.role === "ADMIN";
  const [d, c, drafts] = await Promise.all([staffDashboard(), commandCentre(), creator ? listJobs({ status: "DRAFT" }) : null]);

  return (
    <div className="space-y-6">
      {creator && (
        <section aria-labelledby="create-job" className="space-y-3">
          <div>
            <h2 id="create-job" className="text-xl font-semibold">
              Create a job
            </h2>
            <p className="text-sm text-muted-foreground">Client and materials, then the job, then the cutlist.</p>
          </div>
          <NewJobSection compactHeader />
        </section>
      )}

      {creator && drafts && drafts.rows.length > 0 && (
        <section aria-labelledby="unfinished" className="space-y-3 rounded-lg bg-card p-5">
          <div className="flex items-baseline gap-3">
            <h2 id="unfinished" className="font-semibold">
              Unfinished jobs
            </h2>
            <span className="text-sm text-muted-foreground">Drafts waiting for their cutlist or approval</span>
            <Link href="/admin/jobs?status=DRAFT" className="ml-auto text-sm text-muted-foreground hover:text-foreground hover:underline">
              All drafts
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {drafts.rows.slice(0, 6).map((j) => (
              <li key={j.workNumber} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="font-mono">{j.workNumber}</span>
                <span className="min-w-0 flex-1 truncate">
                  {j.client.businessName ?? j.client.name}
                  {j.title && <span className="text-muted-foreground"> · {j.title}</span>}
                </span>
                <span className="text-muted-foreground">{day.format(j.createdAt)}</span>
                <Link href={`/admin/jobs/${j.workNumber}/cutlist`} className={buttonVariants({ size: "sm" })}>
                  Continue: cutlist
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CommandHeader
        name={user.name}
        timeZone={(await getSettings()).timeZone}
        figures={[
          { label: "Active jobs", value: d.kpis.active, href: "/admin/jobs" },
          { label: "In production", value: d.kpis.inProduction, href: "/admin/queues" },
          { label: "Waiting in queues", value: d.kpis.waitingInQueues, href: "/admin/queues" },
          { label: "Waiting to be taken", value: d.kpis.unassigned, href: "/admin/queues" },
          { label: "Open issues", value: d.kpis.openIssues, href: "/admin/issues", alert: true },
          { label: "Completed, 30 days", value: d.kpis.completed30, href: "/admin/jobs?status=COMPLETED" },
        ]}
        actions={
          <>
            <Link href="/admin/clients/new" className={buttonVariants({ variant: "secondary" })}>
              Register client
            </Link>
            <Link href="/admin/jobs/new" className={buttonVariants({ variant: "gold" })}>
              New job
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <NeedsAttention
          data={c}
          counts={{ unassigned: d.kpis.unassigned, issues: d.kpis.openIssues, awaitingMaterial: d.byStatus.AWAITING_MATERIAL ?? 0 }}
        />
        <QueueSnapshots cutting={c.cutting} cnc={c.cnc} edging={c.edging} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <JobsSunburst byStatus={d.byStatus} />
        <JobsPerDayChart data={d.jobsPerDay} />
        <WorkloadChart data={d.workload} />
        <SheetsByMaterialChart data={d.sheetsByMaterial} />
      </div>

      <ActivityFeed items={c.activity} />
    </div>
  );
}
