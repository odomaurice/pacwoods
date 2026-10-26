import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportIssueButton } from "@/components/issues/IssueButtons";
import IssueList from "@/components/issues/IssueList";
import PageHeader from "@/components/PageHeader";
import { JobStatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { formatMinutes } from "@/lib/cutlist";
import { eventLabel } from "@/lib/events";
import { describeOperations } from "@/lib/jobs";
import { WORK_NUMBER_PATTERN } from "@/lib/numbers";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { clientJobView } from "@/server/services/clientView";
import { clientIssuesForJob } from "@/server/services/issues";

export const metadata: Metadata = { title: "My job | Pacwoods" };

const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function ClientJobPage({ params }: PageProps<"/client/jobs/[workNumber]">) {
  const user = await requireRole("CLIENT");
  const { workNumber } = await params;
  if (!WORK_NUMBER_PATTERN.test(workNumber)) notFound();
  // Another client's job simply does not exist here.
  const view = await clientJobView(user.id, workNumber);
  if (!view) notFound();
  const { job, steps, events, estimate } = view;
  const issues = await clientIssuesForJob(user.id, job._id);

  return (
    <>
      <Link href="/client" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← My jobs
      </Link>
      <PageHeader
        title={job.workNumber}
        description={[job.title, describeOperations(job.operations)].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/client/jobs/${job.workNumber}/card`} className={buttonVariants({ variant: "outline" })}>
              Job card
            </Link>
            <ReportIssueButton target={{ kind: "job", workNumber: job.workNumber }} workNumber={job.workNumber} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="progress" className="rounded-lg bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 id="progress" className="text-lg font-semibold">
              Progress
            </h2>
            <JobStatusBadge status={job.status} />
          </div>
          <ol className="relative space-y-0">
            {steps.map((s, i) => (
              <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
                {i < steps.length - 1 && (
                  <span aria-hidden className={cn("absolute top-7 left-[13px] h-[calc(100%-1.5rem)] w-0.5", s.state === "done" ? "bg-brand-gold" : "bg-border")} />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    s.state === "done" && "bg-brand-gold text-brand-charcoal",
                    s.state === "current" && "bg-brand-charcoal text-white ring-4 ring-brand-gold/30",
                    s.state === "upcoming" && "bg-muted text-muted-foreground",
                    s.state === "na" && "bg-muted text-muted-foreground",
                  )}
                >
                  {s.state === "done" ? "✓" : s.state === "na" ? "–" : i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className={cn("font-medium", s.state === "upcoming" && "text-muted-foreground", s.state === "na" && "text-muted-foreground line-through")}>
                    {s.label}
                    <span className="sr-only">
                      {" "}
                      ({s.state === "done" ? "done" : s.state === "current" ? "next" : s.state === "na" ? "not applicable" : "to come"})
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {s.at ? when.format(s.at) : s.state === "current" ? "Next" : ""}
                    {s.detail && (
                      <span className="block text-foreground/80">{s.detail}</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-6">
          {estimate && (
            <section className="rounded-lg bg-card p-5">
              <h2 className="mb-1 font-semibold">Estimated work time</h2>
              <p className="text-2xl font-semibold">{formatMinutes(estimate.totalMin)}</p>
              <p className="text-sm text-muted-foreground">
                An estimate of machine time once work starts, not a delivery date. Waiting time in the queue is extra.
              </p>
            </section>
          )}
          {job.clientNotes && (
            <section className="rounded-lg bg-card p-5">
              <h2 className="mb-1 font-semibold">Notes from Pacwoods</h2>
              <p className="text-sm whitespace-pre-line">{job.clientNotes}</p>
            </section>
          )}
          <section aria-labelledby="timeline" className="rounded-lg bg-card p-5">
            <h2 id="timeline" className="mb-3 font-semibold">
              Timeline
            </h2>
            <ol className="space-y-3">
              {[...events].reverse().map((e) => (
                <li key={e._id.toString()} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-gold" aria-hidden />
                  <span>
                    <span className="font-medium">{eventLabel(e.type)}</span>
                    <span className="block text-muted-foreground">
                      {when.format(e.at)}
                      {e.reason && ` · ${e.reason}`}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {issues.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold">Your reports</h2>
          <IssueList rows={issues} staff={false} />
        </section>
      )}
    </>
  );
}
