import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import JobSummaryCard from "@/components/production/JobSummaryCard";
import { buttonVariants } from "@/components/ui/button";
import TaskActions from "@/components/production/TaskActions";
import TaskDetail from "@/components/production/TaskDetail";
import { STAGE_LABELS } from "@/lib/production";
import { requireRole } from "@/server/auth/guards";
import { getJobCardData, scanUrl } from "@/server/services/jobCards";
import { loadTaskView } from "@/server/services/taskView";

export const metadata: Metadata = { title: "Job | Pacwoods" };

export default async function OperatorTaskPage({ params }: PageProps<"/operator/tasks/[id]">) {
  const user = await requireRole("OPERATOR");
  const { id } = await params;
  // Not assigned to this operator: it does not exist for them.
  const view = await loadTaskView(user, id);
  if (!view) notFound();
  const { task, job, rule, props, totalPanels } = view;
  const mine = task.assignedOperatorId?.toString() === user.id;
  const card = await getJobCardData(task.workNumber);

  return (
    <>
      <Link href="/operator" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← My queue
      </Link>
      <PageHeader
        title={task.workNumber}
        description={[STAGE_LABELS[task.stage], job.title].filter(Boolean).join(" · ")}
        actions={
          <Link href={`/operator/tasks/${task._id}/card`} className={buttonVariants({ variant: "outline" })}>
            Print job card
          </Link>
        }
      />
      {card && (
        <div className="mb-6">
          <JobSummaryCard data={card.data} scanUrl={await scanUrl(card.qrToken)} />
        </div>
      )}
      {mine && task.status !== "COMPLETED" && (
        <div className="mb-6 rounded-lg bg-card p-5">
          <TaskActions
            taskId={task._id.toString()}
            workNumber={task.workNumber}
            stage={task.stage}
            status={task.status}
            canStart={rule?.canStart ?? false}
            reason={rule?.reason}
            totalPanels={totalPanels}
          />
        </div>
      )}
      <TaskDetail {...props} />
    </>
  );
}
