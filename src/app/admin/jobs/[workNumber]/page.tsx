import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Detail from "@/components/Detail";
import PageHeader from "@/components/PageHeader";
import { JobStatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { describeOperations } from "@/lib/jobs";
import { WORK_NUMBER_PATTERN } from "@/lib/numbers";
import { requireRole } from "@/server/auth/guards";
import { getJobByWorkNumber } from "@/server/services/jobs";

export async function generateMetadata({ params }: PageProps<"/admin/jobs/[workNumber]">): Promise<Metadata> {
  return { title: `${(await params).workNumber} | Pacwoods` };
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function JobPage({ params }: PageProps<"/admin/jobs/[workNumber]">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { workNumber } = await params;
  if (!WORK_NUMBER_PATTERN.test(workNumber)) notFound();
  const found = await getJobByWorkNumber(workNumber);
  if (!found) notFound();
  const { job, profile, clientUser } = found;

  return (
    <>
      <Link href="/admin/jobs" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Jobs
      </Link>
      <PageHeader
        title={job.workNumber}
        description={job.title}
        actions={
          job.status === "DRAFT" && (
            <Link href={`/admin/jobs/${job.workNumber}/edit`} className={buttonVariants({ variant: "outline" })}>
              Edit details
            </Link>
          )
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
      </dl>

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

      <section className="rounded-lg bg-muted p-5">
        <h2 className="font-semibold">Cutlist</h2>
        <p className="text-sm text-muted-foreground">
          No parts or stock sheets yet. The cutlist editor and cutting plan are the next stage of the build.
        </p>
      </section>
    </>
  );
}
