import type { Metadata } from "next";
import Link from "next/link";
import StatTile from "@/components/dashboard/StatTile";
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
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";

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

  const done = jobs.filter((j) => j.status === "COMPLETED").length;
  const inProduction = jobs.filter((j) => ["QUEUED_FOR_CUTTING", "CUTTING_IN_PROGRESS", "QUEUED_FOR_EDGING", "EDGING_IN_PROGRESS"].includes(j.status)).length;
  const updates = jobs.length
    ? await JobStatusEvent.find({ jobId: { $in: jobs.map((j) => j._id) }, clientVisible: true }).sort({ at: -1 }).limit(6).lean()
    : [];
  const workNumberOf = new Map(jobs.map((j) => [j._id.toString(), j.workNumber]));
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

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
      {jobs.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatTile label="All jobs" value={jobs.length} href="/client" />
          <StatTile label="Being worked on" value={inProduction} href="/client" />
          <StatTile label="Completed" value={done} href="/client" />
        </div>
      )}

      {updates.length > 0 && (
        <section aria-labelledby="updates" className="mb-6 rounded-lg bg-card p-5">
          <h2 id="updates" className="mb-3 font-semibold">
            Latest updates
          </h2>
          <ol className="space-y-2 text-sm">
            {updates.map((u) => (
              <li key={u._id.toString()} className="flex flex-wrap gap-x-2">
                <span className="font-mono font-medium">{workNumberOf.get(u.jobId.toString())}</span>
                <span>{u.note ?? u.type.replaceAll("_", " ").toLowerCase()}</span>
                <span className="text-muted-foreground">· {when.format(u.at)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

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
