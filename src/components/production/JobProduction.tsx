import Link from "next/link";
import Detail from "@/components/Detail";
import ReleaseTask from "@/components/production/ReleaseTask";
import { TaskStatusBadge } from "@/components/StatusBadge";
import ViewButton from "@/components/ViewButton";
import { STAGE_LABELS, formatDuration } from "@/lib/production";
import { connectDb } from "@/server/db/connect";
import { User } from "@/server/db/models/User";
import { activeMs, tasksForJob } from "@/server/services/production";
import type { Types } from "mongoose";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/**
 * The job page's production section: each stage, the operator who took it
 * (with their contact details), and how far the work has got. Operators take
 * work themselves; staff can only hand it back to the queue.
 */
export default async function JobProduction({ jobId }: { jobId: Types.ObjectId }) {
  await connectDb();
  const tasks = await tasksForJob(jobId);
  const people = await User.find({ _id: { $in: tasks.flatMap(({ task }) => [task.assignedOperatorId, task.completedBy]).filter(Boolean) } })
    .select("name phone email capabilities status")
    .lean();
  const byId = new Map(people.map((u) => [u._id.toString(), u]));

  return (
    <section aria-labelledby="production" className="mb-8 space-y-4">
      <h2 id="production" className="text-lg font-semibold">
        Production and operators
      </h2>
      {tasks.length === 0 && (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">This job has no production stages.</p>
      )}
      {tasks.map(({ task, sessions }) => {
        const open = task.status !== "COMPLETED" && task.status !== "CANCELLED";
        const op = task.assignedOperatorId ? byId.get(task.assignedOperatorId.toString()) : undefined;
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

            <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
              <div className="rounded-md bg-muted/60 p-4 text-sm">
                <p className="mb-1 text-muted-foreground">Operator</p>
                {op ? (
                  <div className="space-y-0.5">
                    <p className="font-semibold">{op.name}</p>
                    {op.phone && (
                      <p>
                        <a href={`tel:${op.phone}`} className="underline-offset-4 hover:underline">
                          {op.phone}
                        </a>
                      </p>
                    )}
                    {op.email && <p className="break-all">{op.email}</p>}
                    <p className="text-muted-foreground">
                      Skills: {op.capabilities.map((c) => STAGE_LABELS[c as "CUTTING" | "EDGING"]).join(", ")}
                      {op.status !== "ACTIVE" && <span className="text-destructive"> · account {op.status.toLowerCase()}</span>}
                    </p>
                    <Link href={`/admin/accounts/${op._id}`} className="inline-block pt-1 text-sm font-medium underline-offset-4 hover:underline">
                      View operator →
                    </Link>
                  </div>
                ) : (
                  <p className="font-medium">{task.status === "BLOCKED" ? "Not ready yet" : "Not taken yet"}</p>
                )}
              </div>
              <dl className="grid gap-4 sm:grid-cols-3">
                <Detail label="Started">{task.firstStartedAt ? dateFormat.format(task.firstStartedAt) : "—"}</Detail>
                <Detail label="Completed">{task.completedAt ? dateFormat.format(task.completedAt) : "—"}</Detail>
                <Detail label="Time worked">{sessions.length ? formatDuration(activeMs(sessions)) : "—"}</Detail>
              </dl>
            </div>

            {open && op && <ReleaseTask taskId={task._id.toString()} operatorName={op.name} inProgress={task.status === "IN_PROGRESS"} />}
          </div>
        );
      })}
    </section>
  );
}
