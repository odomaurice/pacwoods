import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import JobPhotos from "@/components/photos/JobPhotos";
import JobSummaryCard from "@/components/production/JobSummaryCard";
import { buttonVariants } from "@/components/ui/button";
import TaskActions from "@/components/production/TaskActions";
import TaskDetail from "@/components/production/TaskDetail";
import { STAGE_LABELS } from "@/lib/production";
import { requireRole } from "@/server/auth/guards";
import { Photo } from "@/server/db/models/Photo";
import { getJobCardData, scanUrl } from "@/server/services/jobCards";
import { loadTaskView } from "@/server/services/taskView";

export const metadata: Metadata = { title: "Job | Pacwoods" };

export default async function OperatorTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("OPERATOR");
  const { id } = await params;
  // Taken by another operator: it does not exist for this one.
  const view = await loadTaskView(user, id);
  if (!view) notFound();
  const { task, job, rule, props, totalPanels } = view;
  // Theirs, or open and nobody's yet (starting it takes it).
  const canAct = !task.assignedOperatorId || task.assignedOperatorId.toString() === user.id;
  const card = await getJobCardData(task.workNumber);
  const finishedPhotos = await Photo.countDocuments({ taskId: task._id, kind: "FINISHED" });

  return (
    <>
      <Link href="/operator/queue" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
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
          <JobSummaryCard data={card.data} scanUrl={await scanUrl(card.qrToken)} stage={task.stage} />
        </div>
      )}
      {canAct && task.status !== "COMPLETED" && (
        <div className="mb-6 rounded-lg bg-card p-5">
          <TaskActions
            taskId={task._id.toString()}
            workNumber={task.workNumber}
            stage={task.stage}
            status={task.status}
            canStart={rule?.canStart ?? false}
            reason={rule?.reason}
            totalPanels={totalPanels}
            finishedPhotos={finishedPhotos}
          />
        </div>
      )}
      <TaskDetail {...props} />
      <div className="mt-6">
        <JobPhotos jobId={job._id} viewer={user} stage={task.stage} />
      </div>
    </>
  );
}
