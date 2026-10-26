import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import AssignOperator from "@/components/production/AssignOperator";
import TaskDetail from "@/components/production/TaskDetail";
import { buttonVariants } from "@/components/ui/button";
import { STAGE_LABELS } from "@/lib/production";
import { requireRole } from "@/server/auth/guards";
import { listOperatorsFor } from "@/server/services/production";
import { loadTaskView } from "@/server/services/taskView";

export const metadata: Metadata = { title: "Production task | Pacwoods" };

/** Staff view of one stage of a job: what the operator sees, plus assignment. */
export default async function StaffTaskPage({ params }: PageProps<"/admin/tasks/[id]">) {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  const { id } = await params;
  const view = await loadTaskView(user, id);
  if (!view) notFound();
  const { task, job, props } = view;
  const operators = (await listOperatorsFor(task.stage)).map((o) => ({ id: o._id.toString(), name: o.name }));

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
          <AssignOperator
            taskId={task._id.toString()}
            current={task.assignedOperatorId?.toString()}
            operators={operators}
            inProgress={task.status === "IN_PROGRESS"}
          />
        </section>
      )}
      <TaskDetail {...props} />
    </>
  );
}
