import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApproveCutlistButton, ReopenCutlistButton } from "@/components/cutlist/CutlistActions";
import Detail from "@/components/Detail";
import { MaterialsAvailableButton, MaterialsNotAvailableButton } from "@/components/MaterialActions";
import PageHeader from "@/components/PageHeader";
import JobProduction from "@/components/production/JobProduction";
import { JobStatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { describeOperations, JOB_STATUS_LABELS } from "@/lib/jobs";
import { WORK_NUMBER_PATTERN } from "@/lib/numbers";
import { percent } from "@/lib/plan-text";
import { requireRole } from "@/server/auth/guards";
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";
import { User } from "@/server/db/models/User";
import { loadJobCutlist, planIsCurrent } from "@/server/services/cutlists";
import { getJobByWorkNumber } from "@/server/services/jobs";

export async function generateMetadata({ params }: PageProps<"/admin/jobs/[workNumber]">): Promise<Metadata> {
  return { title: `${(await params).workNumber} | Pacwoods` };
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

const EVENT_LABELS: Record<string, string> = {
  JOB_CREATED: "Job registered",
  PLAN_GENERATED: "Cutting plan generated",
  CUTLIST_APPROVED: "Cutlist approved",
  CUTLIST_REOPENED: "Cutlist reopened for changes",
  MATERIAL_CONFIRMED: "Materials confirmed available",
  MATERIAL_WITHDRAWN: "Materials confirmation withdrawn",
  OPERATOR_ASSIGNED: "Operator assigned",
  CUTTING_STARTED: "Cutting started",
  CUTTING_PAUSED: "Cutting paused",
  CUTTING_RESUMED: "Cutting resumed",
  CUTTING_COMPLETED: "Cutting completed",
  EDGING_STARTED: "Edging started",
  EDGING_PAUSED: "Edging paused",
  EDGING_RESUMED: "Edging resumed",
  EDGING_COMPLETED: "Edging completed",
  JOB_COMPLETED: "Job completed",
  ISSUE_REPORTED: "Issue reported by operator",
};

const BEFORE_PRODUCTION = ["DRAFT", "AWAITING_MATERIAL", "QUEUED_FOR_CUTTING"];

export default async function JobPage({ params }: PageProps<"/admin/jobs/[workNumber]">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { workNumber } = await params;
  if (!WORK_NUMBER_PATTERN.test(workNumber)) notFound();
  const [found, cutlists] = await Promise.all([getJobByWorkNumber(workNumber), loadJobCutlist(workNumber)]);
  if (!found || !cutlists) notFound();
  const { job, profile, clientUser } = found;
  const { current, draft, approved } = cutlists;

  const events = await JobStatusEvent.find({ jobId: job._id }).sort({ at: -1 }).lean();
  const actorIds = [...events.map((e) => e.actorId), job.materialConfirmedBy].filter(Boolean);
  const actors = await User.find({ _id: { $in: actorIds } }).select("name").lean();
  const actorName = new Map(actors.map((a) => [a._id.toString(), a.name]));

  const plan = current?.plan;
  const current_ = current ? planIsCurrent(current) : false;
  const canApprove = job.status === "DRAFT" && draft && current_ && plan && plan.unplaced.length === 0;
  const panels = current?.parts.reduce((n, p) => n + p.quantity, 0) ?? 0;

  return (
    <>
      <Link href="/admin/jobs" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Jobs
      </Link>
      <PageHeader
        title={job.workNumber}
        description={job.title}
        actions={
          <>
            <Link href={`/admin/jobs/${job.workNumber}/card`} className={buttonVariants({ variant: "outline" })}>
              Job card
            </Link>
            {job.status === "DRAFT" && (
              <Link href={`/admin/jobs/${job.workNumber}/edit`} className={buttonVariants({ variant: "outline" })}>
                Edit details
              </Link>
            )}
          </>
        }
      />

      <dl className="mb-8 grid gap-4 rounded-lg bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Status">
          <JobStatusBadge status={job.status} />
        </Detail>
        <Detail label="Work requested">{describeOperations(job.operations)}</Detail>
        <Detail label="Client">
          {profile ? (
            <Link href={`/admin/clients/${profile._id}`} className="underline-offset-4 hover:underline">
              {profile.businessName ?? clientUser?.name}{" "}
              <span className="font-mono text-sm text-muted-foreground">{profile.clientNumber}</span>
            </Link>
          ) : (
            "—"
          )}
        </Detail>
        <Detail label="Created">{dateFormat.format(job.createdAt)}</Detail>
        <Detail label="Last updated">{dateFormat.format(job.updatedAt)}</Detail>
        <Detail label="Materials">
          {job.materialConfirmedAt
            ? `Available · confirmed ${dateFormat.format(job.materialConfirmedAt)}${job.materialConfirmedBy ? ` by ${actorName.get(job.materialConfirmedBy.toString()) ?? "staff"}` : ""}`
            : "Not yet confirmed"}
        </Detail>
        {job.status === "QUEUED_FOR_CUTTING" && job.cuttingQueueSeq != null && (
          <Detail label="Cutting queue">Ticket #{job.cuttingQueueSeq}</Detail>
        )}
      </dl>

      {BEFORE_PRODUCTION.includes(job.status) && (
        <section className="mb-8 flex flex-wrap items-center gap-3 rounded-lg bg-card p-5">
          <div className="mr-auto">
            <h2 className="font-semibold">Materials</h2>
            <p className="text-sm text-muted-foreground">
              {job.materialConfirmedAt
                ? job.status === "QUEUED_FOR_CUTTING"
                  ? "The boards are in the workshop and the job is waiting in the cutting queue."
                  : "The boards are in the workshop. The job joins the cutting queue when its cutlist is approved."
                : job.status === "AWAITING_MATERIAL"
                  ? "The cutlist is approved. Confirm the boards are in the workshop to send the job to the cutting queue."
                  : "Confirm when the boards for this job are in the workshop."}
            </p>
          </div>
          {job.materialConfirmedAt ? (
            <MaterialsNotAvailableButton workNumber={job.workNumber} queued={job.status === "QUEUED_FOR_CUTTING"} />
          ) : (
            <MaterialsAvailableButton workNumber={job.workNumber} approved={job.status === "AWAITING_MATERIAL"} />
          )}
        </section>
      )}

      <JobProduction jobId={job._id} />

      <section className="mb-8 rounded-lg bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Cutlist and cutting plan</h2>
            <p className="text-sm text-muted-foreground">
              {!current
                ? "No cutlist yet."
                : `Version ${current.version} · ${current.state === "APPROVED" ? "approved" : "draft"} · ${current.parts.length} rows, ${panels} panels`}
              {approved && draft && ` · version ${approved.version} remains approved until this draft is approved`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/jobs/${job.workNumber}/cutlist`} className={buttonVariants({ variant: job.status === "DRAFT" ? "default" : "outline" })}>
              {job.status === "DRAFT" ? (current ? "Edit cutlist" : "Start cutlist") : "View cutlist"}
            </Link>
            {plan && (
              <Link href={`/admin/jobs/${job.workNumber}/plan`} className={buttonVariants({ variant: "outline" })}>
                View cutting plan
              </Link>
            )}
            {canApprove && <ApproveCutlistButton workNumber={job.workNumber} />}
            {(job.status === "AWAITING_MATERIAL" || job.status === "QUEUED_FOR_CUTTING") && <ReopenCutlistButton workNumber={job.workNumber} />}
          </div>
        </div>
        {plan && (
          <dl className="grid gap-4 sm:grid-cols-4">
            <Detail label="Sheets">{plan.totals.sheetsUsed}</Detail>
            <Detail label="Utilisation">{percent(plan.totals.utilization)}</Detail>
            <Detail label="Panels placed">
              {plan.totals.partsPlaced} of {plan.totals.partsRequested}
            </Detail>
            <Detail label="Plan">{current_ ? "Up to date" : "Out of date — regenerate"}</Detail>
          </dl>
        )}
      </section>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-lg bg-card p-5">
          <h2 className="mb-2 font-semibold">Notes for the client</h2>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{job.clientNotes || "None."}</p>
        </section>
        <section className="rounded-lg bg-card p-5">
          <h2 className="mb-2 font-semibold">Internal notes</h2>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{job.internalNotes || "None."}</p>
        </section>
      </div>

      <section className="rounded-lg bg-card p-5">
        <h2 className="mb-3 font-semibold">Timeline</h2>
        <ol className="space-y-3">
          {events.map((e) => (
            <li key={e._id.toString()} className="flex gap-3 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-gold" aria-hidden />
              <span>
                <span className="font-medium">{EVENT_LABELS[e.type] ?? e.type}</span>
                {e.from && e.to && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {JOB_STATUS_LABELS[e.from]} → {JOB_STATUS_LABELS[e.to]}
                  </span>
                )}
                <span className="block text-muted-foreground">
                  {dateFormat.format(e.at)}
                  {e.actorId && ` · ${actorName.get(e.actorId.toString()) ?? "Unknown"}`}
                  {e.note && ` · ${e.note}`}
                  {e.reason && ` · Reason: ${e.reason}`}
                  {!e.clientVisible && " · staff only"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
