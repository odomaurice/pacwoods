import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { Job } from "@/server/db/models/Job";
import { ProductionTask } from "@/server/db/models/ProductionTask";

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
      // Straight to this job if it is assigned to them; otherwise their queue.
      const task = await ProductionTask.findOne({ jobId: job._id, assignedOperatorId: user.id }).sort({ status: 1 }).select("_id").lean();
      redirect(task ? `/operator/tasks/${task._id}` : "/operator/queue");
    }
  }
}
