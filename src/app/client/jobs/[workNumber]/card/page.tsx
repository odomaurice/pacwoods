import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportIssueButton } from "@/components/issues/IssueButtons";
import IssueList from "@/components/issues/IssueList";
import JobCard from "@/components/JobCard";
import PrintButton from "@/components/PrintButton";
import { buttonVariants } from "@/components/ui/button";
import { WORK_NUMBER_PATTERN } from "@/lib/numbers";
import { requireRole } from "@/server/auth/guards";
import { connectDb } from "@/server/db/connect";
import { Job } from "@/server/db/models/Job";
import { clientIssuesForJob } from "@/server/services/issues";
import { getJobCardData, scanUrl } from "@/server/services/jobCards";

export const metadata: Metadata = { title: "Job card | Pacwoods" };

export default async function ClientJobCardPage({ params }: PageProps<"/client/jobs/[workNumber]/card">) {
  const user = await requireRole("CLIENT");
  const { workNumber } = await params;
  if (!WORK_NUMBER_PATTERN.test(workNumber)) notFound();
  // Another client's work number simply does not exist for this client.
  const found = await getJobCardData(workNumber, { ownerUserId: user.id });
  if (!found) notFound();
  await connectDb();
  const job = await Job.findOne({ workNumber }).select("_id").lean();
  const myIssues = job ? await clientIssuesForJob(user.id, job._id) : [];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 print:hidden">
        <Link href="/client/jobs" className={buttonVariants({ variant: "outline" })}>
          Back to my jobs
        </Link>
        <PrintButton label="Print job card" />
        <ReportIssueButton target={{ kind: "job", workNumber }} workNumber={workNumber} />
      </div>
      {myIssues.length > 0 && (
        <section className="space-y-3 print:hidden">
          <h2 className="text-lg font-semibold">Your reports</h2>
          <IssueList rows={myIssues} staff={false} />
        </section>
      )}
      <JobCard data={found.data} scanUrl={await scanUrl(found.qrToken)} audience="client" />
    </div>
  );
}
