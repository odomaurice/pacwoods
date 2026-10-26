import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { Job } from "@/server/db/models/Job";

/**
 * Where a scanned job QR code lands. The token is opaque; the job is only
 * revealed after sign-in, and only to someone allowed to see it.
 */
export default async function ScanPage({ params }: PageProps<"/j/[token]">) {
  const user = await requireUser();
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();

  await connectDb();
  const job = await Job.findOne({ qrToken: token }).select("workNumber clientId").lean();
  if (!job) notFound();

  switch (user.role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      redirect(`/admin/jobs/${job.workNumber}`);
    case "CLIENT": {
      const owns = await ClientProfile.exists({ _id: job.clientId, userId: user.id });
      if (!owns) notFound();
      redirect(`/client/jobs/${job.workNumber}/card`);
    }
    case "OPERATOR":
      // Operators reach jobs through their queue (production phase).
      redirect("/operator");
  }
}
