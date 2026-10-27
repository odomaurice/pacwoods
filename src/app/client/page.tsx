import type { Metadata } from "next";
import Link from "next/link";
import { CommandHeader } from "@/components/dashboard/CommandCentre";
import EmptyState from "@/components/EmptyState";
import { JobStatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import ViewButton from "@/components/ViewButton";
import { eventLabel } from "@/lib/events";
import { describeOperations } from "@/lib/jobs";
import { requireRole } from "@/server/auth/guards";
import { getSettings } from "@/server/services/settings";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { Issue } from "@/server/db/models/Issue";
import { Job } from "@/server/db/models/Job";
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";
import { Photo } from "@/server/db/models/Photo";
import { clientJobView } from "@/server/services/clientView";

export const metadata: Metadata = { title: "Overview | Pacwoods" };

const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const ACTIVE = ["DRAFT", "AWAITING_APPROVAL", "AWAITING_MATERIAL", "QUEUED_FOR_CUTTING", "CUTTING_IN_PROGRESS", "AWAITING_EDGING", "QUEUED_FOR_EDGING", "EDGING_IN_PROGRESS", "AWAITING_QUALITY_CHECK", "ON_HOLD"];

/** The client's home: where each of their jobs is, from real events only. */
export default async function ClientOverview() {
  const user = await requireRole("CLIENT");
  await connectDb();
  // Ownership comes from the session, never from the URL.
  const profile = await ClientProfile.findOne({ userId: user.id }).lean();
  const jobs = profile ? await Job.find({ clientId: profile._id }).sort({ createdAt: -1 }).select("workNumber title status operations createdAt").lean() : [];
  const ids = jobs.map((j) => j._id);

  const active = jobs.filter((j) => ACTIVE.includes(j.status));
  const [views, updates, photos, openReports] = await Promise.all([
    Promise.all(active.slice(0, 6).map((j) => clientJobView(user.id, j.workNumber))),
    ids.length ? JobStatusEvent.find({ jobId: { $in: ids }, clientVisible: true }).sort({ at: -1 }).limit(8).lean() : [],
    ids.length ? Photo.find({ jobId: { $in: ids } }).sort({ createdAt: -1 }).limit(8).select("workNumber kind").lean() : [],
    Issue.countDocuments({ reportedBy: user.id, status: "OPEN" }),
  ]);
  const workNumberOf = new Map(jobs.map((j) => [j._id.toString(), j.workNumber]));
  const inProduction = jobs.filter((j) => ["CUTTING_IN_PROGRESS", "EDGING_IN_PROGRESS", "QUEUED_FOR_CUTTING", "QUEUED_FOR_EDGING"].includes(j.status)).length;

  return (
    <div className="space-y-6">
      <CommandHeader
        name={user.name}
        timeZone={(await getSettings()).timeZone}
        figures={[
          { label: "All jobs", value: jobs.length, href: "/client/jobs" },
          { label: "Active", value: active.length, href: "/client/jobs" },
          { label: "Being cut or edged", value: inProduction, href: "/client/jobs" },
          { label: "Completed", value: jobs.filter((j) => j.status === "COMPLETED").length, href: "/client/jobs" },
          { label: "My open reports", value: openReports, href: "/client/jobs", alert: true },
        ]}
        actions={
          <>
            <Link href="/client/card" className={buttonVariants({ variant: "secondary" })}>
              My client card
            </Link>
            {profile && <span className="self-center font-mono text-sm text-brand-gold">{profile.clientNumber}</span>}
          </>
        }
      />

      <section aria-labelledby="active" className="space-y-3">
        <h2 id="active" className="text-lg font-semibold">
          Jobs in progress
        </h2>
        {views.length === 0 ? (
          <EmptyState title={jobs.length ? "No jobs in progress. Completed jobs are under My jobs." : "You have no jobs with Pacwoods yet."} />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {views.map((v) => {
              if (!v) return null;
              const applicable = v.steps.filter((s) => s.state !== "na");
              const done = applicable.filter((s) => s.state === "done").length;
              const current = v.steps.find((s) => s.state === "current");
              return (
                <li key={v.job.workNumber} className="space-y-3 rounded-lg bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{v.job.workNumber}</span>
                    <JobStatusBadge status={v.job.status} />
                    <span className="ml-auto">
                      <ViewButton href={`/client/jobs/${v.job.workNumber}`} label={`View ${v.job.workNumber}`} />
                    </span>
                  </div>
                  {v.job.title && <p className="font-medium">{v.job.title}</p>}
                  <p className="text-sm text-muted-foreground">{describeOperations(v.job.operations)}</p>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{current ? `Next: ${current.label}` : "All steps done"}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {done} of {applicable.length} steps
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={applicable.length} aria-valuenow={done} aria-label={`${v.job.workNumber} progress`}>
                      <div className="h-full rounded-full bg-brand-gold" style={{ width: `${(done / applicable.length) * 100}%` }} />
                    </div>
                    {current?.detail && <p className="mt-2 text-sm text-muted-foreground">{current.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="photos" className="rounded-lg bg-card p-5">
          <h2 id="photos" className="mb-3 font-semibold">
            Latest photos
          </h2>
          {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Photos of your wood and finished work appear here.</p>
          ) : (
            <ul className="grid grid-cols-4 gap-2">
              {photos.map((p) => (
                <li key={p._id.toString()}>
                  <Link href={`/client/jobs/${p.workNumber}`} className="block overflow-hidden rounded-md bg-muted" aria-label={`${p.kind === "FINISHED" ? "Finished work" : "Wood"}, ${p.workNumber}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photos/${p._id}?size=thumb`} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="updates" className="rounded-lg bg-card p-5">
          <h2 id="updates" className="mb-3 font-semibold">
            Latest updates
          </h2>
          {updates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ol className="space-y-3">
              {updates.map((u) => (
                <li key={u._id.toString()} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-gold" aria-hidden />
                  <span>
                    <span className="font-medium">{eventLabel(u.type)}</span>
                    {" · "}
                    <Link href={`/client/jobs/${workNumberOf.get(u.jobId.toString())}`} className="font-mono underline-offset-4 hover:underline">
                      {workNumberOf.get(u.jobId.toString())}
                    </Link>
                    <span className="block text-muted-foreground">{when.format(u.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
