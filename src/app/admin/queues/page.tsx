import type { Metadata } from "next";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ViewButton from "@/components/ViewButton";
import { STAGES, STAGE_LABELS } from "@/lib/production";
import { requireRole } from "@/server/auth/guards";
import { listStageQueue } from "@/server/services/production";

export const metadata: Metadata = { title: "Queues | Pacwoods" };

export default async function QueuesPage() {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const queues = await Promise.all(STAGES.map(async (stage) => ({ stage, rows: await listStageQueue(stage) })));

  return (
    <div className="space-y-8">
      <PageHeader title="Production queues" description="First come, first served. Operators take the oldest ready job first." />
      {queues.map(({ stage, rows }) => {
        const waiting = rows.filter((r) => r.task.status !== "BLOCKED");
        const upcoming = rows.filter((r) => r.task.status === "BLOCKED");
        return (
          <section key={stage} aria-labelledby={`queue-${stage}`} className="space-y-3">
            <h2 id={`queue-${stage}`} className="text-lg font-semibold">
              {STAGE_LABELS[stage]} queue <span className="font-normal text-muted-foreground">· {waiting.length}</span>
            </h2>
            {waiting.length === 0 ? (
              <EmptyState title={`Nothing in the ${STAGE_LABELS[stage].toLowerCase()} queue.`} />
            ) : (
              <div className="rounded-lg bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Work no.</TableHead>
                      <TableHead>Operator</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {waiting.map(({ task, operatorName }) => (
                      <TableRow key={task._id.toString()}>
                        <TableCell className="tabular-nums">#{task.queueSeq}</TableCell>
                        <TableCell className="font-mono">{task.workNumber}</TableCell>
                        <TableCell>{operatorName ?? <span className="text-muted-foreground">Not taken yet</span>}</TableCell>
                        <TableCell>
                          <TaskStatusBadge status={task.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ViewButton href={`/admin/tasks/${task._id}`} label={`View ${task.workNumber} ${STAGE_LABELS[stage].toLowerCase()}`} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {upcoming.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {stage === "EDGING" ? "Waiting for cutting to finish" : "Not in the queue yet (cutlist or materials pending)"}:{" "}
                {upcoming.map((r) => r.task.workNumber).join(", ")}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
