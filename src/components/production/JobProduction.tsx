import Detail from "@/components/Detail";
import AssignOperator from "@/components/production/AssignOperator";
import { TaskStatusBadge } from "@/components/StatusBadge";
import ViewButton from "@/components/ViewButton";
import { STAGE_LABELS, formatDuration } from "@/lib/production";
import { connectDb } from "@/server/db/connect";
import { User } from "@/server/db/models/User";
import { activeMs, listOperatorsFor, tasksForJob } from "@/server/services/production";
import type { Types } from "mongoose";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** The job page's production section: each stage, who has it, and how far it got. */
export default async function JobProduction({ jobId }: { jobId: Types.ObjectId }) {
  await connectDb();
  const tasks = await tasksForJob(jobId);
  if (tasks.length === 0) return null;
  const [cutters, edgers] = await Promise.all([listOperatorsFor("CUTTING"), listOperatorsFor("EDGING")]);
  const names = new Map(
    (await User.find({ _id: { $in: tasks.flatMap(({ task }) => [task.assignedOperatorId, task.completedBy]).filter(Boolean) } }).select("name").lean()).map((u) => [
      u._id.toString(),
      u.name,
    ]),
  );

  return (
    <section className="mb-8 space-y-4">
      <h2 className="text-lg font-semibold">Production</h2>
      {tasks.map(({ task, sessions }) => {
        const pool = (task.stage === "CUTTING" ? cutters : edgers).map((o) => ({ id: o._id.toString(), name: o.name }));
        const open = task.status !== "COMPLETED" && task.status !== "CANCELLED";
        return (
          <div key={task._id.toString()} className="space-y-4 rounded-lg bg-card p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-semibold">{STAGE_LABELS[task.stage]}</h3>
              <TaskStatusBadge status={task.status} />
              {task.queueSeq != null && <span className="text-sm text-muted-foreground">Ticket #{task.queueSeq}</span>}
              <span className="ml-auto">
                <ViewButton href={`/admin/tasks/${task._id}`} label={`View ${STAGE_LABELS[task.stage].toLowerCase()}`} />
              </span>
            </div>
            <dl className="grid gap-4 sm:grid-cols-4">
              <Detail label="Operator">
                {task.assignedOperatorId ? (names.get(task.assignedOperatorId.toString()) ?? "—") : <span className="text-destructive">Needs assignment</span>}
              </Detail>
              <Detail label="Started">{task.firstStartedAt ? dateFormat.format(task.firstStartedAt) : "—"}</Detail>
              <Detail label="Completed">{task.completedAt ? dateFormat.format(task.completedAt) : "—"}</Detail>
              <Detail label="Time worked">{sessions.length ? formatDuration(activeMs(sessions)) : "—"}</Detail>
            </dl>
            {open && <AssignOperator taskId={task._id.toString()} current={task.assignedOperatorId?.toString()} operators={pool} inProgress={task.status === "IN_PROGRESS"} />}
          </div>
        );
      })}
    </section>
  );
}
