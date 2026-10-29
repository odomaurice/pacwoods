import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { Job } from "@/server/db/models/Job";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { capabilitiesOf, operatorCanSee } from "@/server/services/production";

/**
 * Where a scanned job QR code lands. The token is opaque; the job is only
 * revealed after sign-in, and only to someone allowed to see it.
 */
export default async function ScanPage({ params }: PageProps<"/j/[token]">) {
  const user = await requireUser();
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();

  await connectDb();
  const job = await Job.findOne({ qrToken: token }).select("_id workNumber clientId").lean();
  if (!job) notFound();

  switch (user.role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      redirect(`/admin/jobs/${job.workNumber}`);
    case "CLIENT": {
      const owns = await ClientProfile.exists({ _id: job.clientId, userId: user.id });
      if (!owns) notFound();
      redirect(`/client/jobs/${job.workNumber}`);
    }
    case "OPERATOR": {
      // Straight to the stage they are on or can take; otherwise their queue.
      const capabilities = await capabilitiesOf(user.id);
      const tasks = await ProductionTask.find({ jobId: job._id }).sort({ stage: 1 }).select("stage status assignedOperatorId completedBy").lean();
      const open = (t: (typeof tasks)[number]) => t.status !== "COMPLETED" && t.status !== "CANCELLED";
      const visible = tasks.filter((t) => operatorCanSee(t, { id: user.id, capabilities }));
      const task = visible.find((t) => open(t) && t.assignedOperatorId?.toString() === user.id) ?? visible.find(open) ?? visible[0];
      redirect(task ? `/operator/tasks/${task._id}` : "/operator/queue");
    }
  }
}
