import type { Metadata } from "next";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import TaskActions from "@/components/production/TaskActions";
import { TaskStatusBadge } from "@/components/StatusBadge";
import ViewButton from "@/components/ViewButton";
import { STAGES, STAGE_LABELS } from "@/lib/production";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { operatorQueue } from "@/server/services/production";

export const metadata: Metadata = { title: "My queue | Pacwoods" };

export default async function OperatorQueue() {
  const user = await requireRole("OPERATOR");
  const rows = await operatorQueue(user.id);
  const active = rows.find((r) => r.task.status === "IN_PROGRESS");

  return (
    <div className="space-y-8">
      <PageHeader title="My queue" description="Your assigned work, in order. Only the next job in each queue can be started." />

      {active && (
        <section aria-labelledby="active" className="space-y-3 rounded-lg bg-brand-charcoal p-5 text-white">
          <p id="active" className="text-xs font-semibold tracking-[0.2em] text-brand-gold uppercase">
            In progress · {STAGE_LABELS[active.task.stage]}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-2xl font-semibold">{active.task.workNumber}</p>
              {active.job?.title && <p className="text-white/90">{active.job.title}</p>}
            </div>
            <ViewButton href={`/operator/tasks/${active.task._id}`} label={`View ${active.task.workNumber}`} />
          </div>
        </section>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No work is assigned to you." />
      ) : (
        STAGES.filter((stage) => user.capabilities.includes(stage) || rows.some((r) => r.task.stage === stage)).map((stage) => {
          const list = rows.filter((r) => r.task.stage === stage);
          return (
            <section key={stage} aria-labelledby={`q-${stage}`} className="space-y-3">
              <h2 id={`q-${stage}`} className="text-lg font-semibold">
                {STAGE_LABELS[stage]} queue
              </h2>
              {list.length === 0 ? (
                <EmptyState title={`No ${STAGE_LABELS[stage].toLowerCase()} assigned to you.`} />
              ) : (
                <ol className="space-y-3">
                  {list.map(({ task, job, rule }, i) => (
                    <li key={task._id.toString()} className={cn("rounded-lg bg-card p-4", !rule.canStart && task.status !== "IN_PROGRESS" && "opacity-80")}>
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums" aria-label={`Position ${i + 1}`}>
                          {i + 1}
                        </span>
                        <span className="font-mono font-semibold">{task.workNumber}</span>
                        <TaskStatusBadge status={task.status} />
                        {job?.title && <span className="text-sm text-muted-foreground">{job.title}</span>}
                        <span className="ml-auto">
                          <ViewButton href={`/operator/tasks/${task._id}`} label={`View ${task.workNumber}`} />
                        </span>
                      </div>
                      {task.status !== "IN_PROGRESS" && (
                        <TaskActions
                          taskId={task._id.toString()}
                          workNumber={task.workNumber}
                          stage={task.stage}
                          status={task.status}
                          canStart={rule.canStart}
                          reason={rule.reason}
                          totalPanels={0}
                          startOnly
                        />
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
