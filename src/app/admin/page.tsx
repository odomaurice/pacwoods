import type { Metadata } from "next";
import Link from "next/link";
import { JobsPerDayChart, JobsSunburst, SheetsByMaterialChart, WorkloadChart } from "@/components/dashboard/Charts";
import { ActivityFeed, CommandHeader, NeedsAttention, QueueSnapshots } from "@/components/dashboard/CommandCentre";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { getSettings } from "@/server/services/settings";
import { commandCentre, staffDashboard } from "@/server/services/dashboard";

export const metadata: Metadata = { title: "Overview | Pacwoods" };

/** The command centre. Everything here is counted from the database at request time. */
export default async function AdminOverview() {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  const [d, c] = await Promise.all([staffDashboard(), commandCentre()]);

  return (
    <div className="space-y-6">
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
