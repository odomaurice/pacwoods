import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import JobSummaryCard from "@/components/production/JobSummaryCard";
import TaskActions from "@/components/production/TaskActions";
import { TaskStatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import ViewButton from "@/components/ViewButton";
import { STAGES, STAGE_LABELS, stageNoun } from "@/lib/production";
import { requireRole } from "@/server/auth/guards";
import { getJobCardData, scanUrl } from "@/server/services/jobCards";
import { operatorQueue } from "@/server/services/production";

export const metadata: Metadata = { title: "My queue | Pacwoods" };

export default async function OperatorQueue() {
  const user = await requireRole("OPERATOR");
  const rows = await operatorQueue(user.id);
  const cards = await Promise.all(
    rows.map(async (r) => {
      const found = await getJobCardData(r.task.workNumber);
      return { ...r, card: found ? { data: found.data, url: await scanUrl(found.qrToken) } : null };
    }),
  );

  return (
    <div className="space-y-8">
      <PageHeader title="My queue" description="Every job you can work on, oldest first. Start the next one to take it; jobs another operator has taken are not shown." />

      {cards.length === 0 ? (
        <EmptyState title="There is no work for you right now." />
      ) : (
        STAGES.filter((stage) => user.capabilities.includes(stage) || cards.some((r) => r.task.stage === stage)).map((stage) => {
          const list = cards.filter((r) => r.task.stage === stage).sort((a, b) => Number(b.task.status === "IN_PROGRESS") - Number(a.task.status === "IN_PROGRESS"));
          return (
            <section key={stage} aria-labelledby={`q-${stage}`} className="space-y-3">
              <h2 id={`q-${stage}`} className="text-lg font-semibold">
                {STAGE_LABELS[stage]} queue <span className="font-normal text-muted-foreground">· {list.length}</span>
              </h2>
              {list.length === 0 ? (
                <EmptyState title={`No ${stageNoun(stage)} waiting.`} />
              ) : (
                <ol className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {list.map(({ task, rule, card }, i) => {
                    const id = task._id.toString();
                    const header = (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold" aria-label={`Position ${i + 1}`}>
                          #{i + 1}
                        </span>
                        <TaskStatusBadge status={task.status} />
                        {task.status === "IN_PROGRESS" && <span className="text-xs font-semibold tracking-wide text-brand-gold uppercase">Working now</span>}
                        {task.status === "PAUSED" && task.assignedOperatorId && <span className="text-xs font-semibold tracking-wide text-brand-gold uppercase">Yours</span>}
                      </div>
                    );
                    const actions = (
                      <div className="space-y-2">
                        {task.status !== "IN_PROGRESS" && (
                          <TaskActions taskId={id} workNumber={task.workNumber} stage={task.stage} status={task.status} canStart={rule.canStart} reason={rule.reason} totalPanels={0} startOnly />
                        )}
                        <div className="flex flex-wrap gap-2">
                          <ViewButton href={`/operator/tasks/${id}`} label={`View ${task.workNumber}`} />
                          <Link href={`/operator/tasks/${id}/card`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            Print job card
                          </Link>
                        </div>
                      </div>
                    );
                    return (
                      <li key={id}>
                        {card ? (
                          <JobSummaryCard data={card.data} scanUrl={card.url} header={header} compact stage={task.stage}>
                            {actions}
                          </JobSummaryCard>
                        ) : (
                          <div className="rounded-lg bg-card p-4">
                            {task.workNumber} {actions}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
