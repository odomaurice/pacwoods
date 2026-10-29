import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ReleaseTask from "@/components/production/ReleaseTask";
import TaskDetail from "@/components/production/TaskDetail";
import { buttonVariants } from "@/components/ui/button";
import { STAGE_LABELS } from "@/lib/production";
import { requireRole } from "@/server/auth/guards";
import { connectDb } from "@/server/db/connect";
import { User } from "@/server/db/models/User";
import { loadTaskView } from "@/server/services/taskView";

export const metadata: Metadata = { title: "Production task | Pacwoods" };

/** Staff view of one stage of a job: what the operator sees, plus releasing it back to the queue. */
export default async function StaffTaskPage({ params }: PageProps<"/admin/tasks/[id]">) {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  const { id } = await params;
  const view = await loadTaskView(user, id);
  if (!view) notFound();
  const { task, job, props } = view;
  await connectDb();
  const taker = task.assignedOperatorId ? await User.findById(task.assignedOperatorId).select("name").lean() : null;

  return (
    <>
      <Link href="/admin/queues" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Queues
      </Link>
      <PageHeader
        title={`${task.workNumber} · ${STAGE_LABELS[task.stage]}`}
        description={job.title}
        actions={
          <Link href={`/admin/jobs/${task.workNumber}`} className={buttonVariants({ variant: "outline" })}>
            Open job
          </Link>
        }
      />
      {task.status !== "COMPLETED" && task.status !== "CANCELLED" && (
        <section className="mb-6 rounded-lg bg-card p-5">
          <h2 className="mb-2 font-semibold">Operator</h2>
          {taker ? (
            <div className="flex flex-wrap items-center gap-3">
              <p>
                Taken by <span className="font-medium">{taker.name}</span>
              </p>
              <ReleaseTask taskId={task._id.toString()} operatorName={taker.name} inProgress={task.status === "IN_PROGRESS"} />
            </div>
          ) : (
            <p className="text-muted-foreground">
              {task.status === "BLOCKED" ? "Not ready yet." : "Not taken yet. The first operator to start it takes it."}
            </p>
          )}
        </section>
      )}
      <TaskDetail {...props} />
    </>
  );
}
