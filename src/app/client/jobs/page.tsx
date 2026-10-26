import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { JobStatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import ViewButton from "@/components/ViewButton";
import { describeOperations } from "@/lib/jobs";
import { requireRole } from "@/server/auth/guards";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { Job } from "@/server/db/models/Job";

export const metadata: Metadata = { title: "My jobs | Pacwoods" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export default async function ClientJobs() {
  const user = await requireRole("CLIENT");

  // Ownership comes from the session, never from the URL or the form.
  await connectDb();
  const profile = await ClientProfile.findOne({ userId: user.id }).lean();
  const jobs = profile
    ? await Job.find({ clientId: profile._id })
        .select("workNumber title status operations clientNotes createdAt")
        .sort({ createdAt: -1 })
        .lean()
    : [];


  return (
    <>
      <PageHeader
        title="My jobs"
        description={
          profile ? (
            <>
              Welcome, {user.name}. Your client number is <span className="font-mono">{profile.clientNumber}</span>.
            </>
          ) : (
            `Welcome, ${user.name}.`
          )
        }
      />
      {jobs.length === 0 ? (
        <EmptyState title="You have no jobs with Pacwoods yet." />
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job._id.toString()} className="rounded-lg bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono font-semibold">{job.workNumber}</p>
                <JobStatusBadge status={job.status} />
              </div>
              {job.title && <p className="mt-1 font-medium">{job.title}</p>}
              <p className="mt-1 text-sm text-muted-foreground">
                {describeOperations(job.operations)} · Registered {dateFormat.format(job.createdAt)}
              </p>
              {job.clientNotes && <p className="mt-3 text-sm whitespace-pre-line">{job.clientNotes}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <ViewButton href={`/client/jobs/${job.workNumber}`} label={`View ${job.workNumber}`} />
                <Link href={`/client/jobs/${job.workNumber}/card`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Job card
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
