import type { Metadata } from "next";
import Link from "next/link";
import { DailyBarChart } from "@/components/dashboard/Charts";
import { CommandHeader } from "@/components/dashboard/CommandCentre";
import EmptyState from "@/components/EmptyState";
import IssueList from "@/components/issues/IssueList";
import JobSummaryCard from "@/components/production/JobSummaryCard";
import TaskActions from "@/components/production/TaskActions";
import { buttonVariants } from "@/components/ui/button";
import ViewButton from "@/components/ViewButton";
import { STAGE_LABELS, formatDuration } from "@/lib/production";
import { requireRole } from "@/server/auth/guards";
import { operatorDashboard, operatorIssues } from "@/server/services/dashboard";
import { getJobCardData, scanUrl } from "@/server/services/jobCards";
import { operatorHistory, operatorQueue } from "@/server/services/production";

export const metadata: Metadata = { title: "Overview | Pacwoods" };

const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** The operator's home: what they are on, what is next, and how their week went. */
export default async function OperatorOverview() {
  const user = await requireRole("OPERATOR");
  const [queue, stats, history, issues] = await Promise.all([operatorQueue(user.id), operatorDashboard(user.id), operatorHistory(user.id), operatorIssues(user.id)]);

  const active = queue.find((q) => q.task.status === "IN_PROGRESS");
  const next = active ? undefined : queue.find((q) => q.rule.canStart);
  const focus = active ?? next;
  const card = focus ? await getJobCardData(focus.task.workNumber) : null;
  const openIssues = issues.filter((i) => i.status === "OPEN").length;

  return (
    <div className="space-y-6">
      <CommandHeader
        name={user.name}
        figures={[
          { label: "In my queue", value: stats.waiting, href: "/operator/queue" },
          { label: "Completed this week", value: stats.completedThisWeek, href: "/operator/history" },
          { label: "Hours worked this week", value: stats.hoursThisWeek, href: "/operator/history" },
          { label: "My open reports", value: openIssues, href: "/operator", alert: true },
        ]}
        actions={
          <Link href="/operator/queue" className={buttonVariants({ className: "bg-brand-gold text-brand-charcoal hover:bg-brand-gold/90" })}>
            Open my queue
          </Link>
        }
      />

      <section aria-labelledby="focus" className="space-y-3">
        <h2 id="focus" className="text-lg font-semibold">
          {active ? "Working now" : "Next up"}
        </h2>
        {focus && card ? (
          <JobSummaryCard
            data={card.data}
            scanUrl={await scanUrl(card.qrToken)}
            header={<p className="text-xs font-semibold tracking-[0.2em] text-brand-gold uppercase">{STAGE_LABELS[focus.task.stage]}</p>}
          >
            <div className="space-y-3">
              {!active && (
                <TaskActions
                  taskId={focus.task._id.toString()}
                  workNumber={focus.task.workNumber}
                  stage={focus.task.stage}
                  status={focus.task.status}
                  canStart={focus.rule.canStart}
                  reason={focus.rule.reason}
                  totalPanels={0}
                  startOnly
                />
              )}
              <div className="flex flex-wrap gap-2">
                <Link href={`/operator/tasks/${focus.task._id}`} className={buttonVariants({ size: active ? "lg" : "sm", className: active ? "h-12 px-6 text-base" : undefined })}>
                  {active ? "Continue: pause or complete" : "View job"}
                </Link>
                <Link href={`/operator/tasks/${focus.task._id}/card`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Print job card
                </Link>
              </div>
            </div>
          </JobSummaryCard>
        ) : (
          <EmptyState title={queue.length ? "Nothing can be started right now." : "No work is assigned to you."}>
            {queue.length > 0 && "Your assigned jobs are waiting for cutting, materials or approval. See My queue for details."}
          </EmptyState>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <DailyBarChart data={stats.completedPerDay} title="Work I completed" unit="Stages completed" />

        <section aria-labelledby="recent" className="rounded-lg bg-card p-5">
          <div className="mb-3 flex items-center">
            <h2 id="recent" className="font-semibold">
              Recently completed
            </h2>
            <Link href="/operator/history" className="ml-auto text-sm text-muted-foreground hover:text-foreground hover:underline">
              All history
            </Link>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing completed yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.slice(0, 5).map(({ task, activeMs }) => (
                <li key={task._id.toString()} className="flex items-center gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-medium">{task.workNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {STAGE_LABELS[task.stage]} · {task.completedAt ? when.format(task.completedAt) : ""} · {formatDuration(activeMs)}
                    </p>
                  </div>
                  <ViewButton href={`/operator/tasks/${task._id}`} label={`View ${task.workNumber}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {issues.length > 0 && (
        <section aria-labelledby="my-issues" className="space-y-3">
          <h2 id="my-issues" className="text-lg font-semibold">
            Problems I reported
          </h2>
          <IssueList rows={issues} staff={false} />
        </section>
      )}
    </div>
  );
}
