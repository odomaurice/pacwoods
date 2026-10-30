import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobSteps from "@/components/jobs/JobSteps";
import JobMaterialsSection from "@/components/materials/JobMaterialsSection";
import PageHeader from "@/components/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { WORK_NUMBER_PATTERN } from "@/lib/numbers";
import { requireRole } from "@/server/auth/guards";
import { User } from "@/server/db/models/User";
import { getJobByWorkNumber } from "@/server/services/jobs";

export const metadata: Metadata = { title: "Materials | Pacwoods" };

/** Step 3 of a new job: the boards. The same section is on the job page later. */
export default async function JobMaterialsPage({ params }: PageProps<"/admin/jobs/[workNumber]/materials">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { workNumber } = await params;
  if (!WORK_NUMBER_PATTERN.test(workNumber)) notFound();
  const found = await getJobByWorkNumber(workNumber);
  if (!found) notFound();
  const { job } = found;
  const confirmer = job.materialConfirmedBy ? await User.findById(job.materialConfirmedBy).select("name").lean() : null;

  return (
    <>
      <Link href={`/admin/jobs/${workNumber}`} className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← {workNumber}
      </Link>
      <PageHeader title={`Materials · ${workNumber}`} description="Step 3: which boards this job uses, and whether they are in the workshop. You can come back to this at any time." />
      <JobSteps current={3} workNumber={workNumber} />
      <JobMaterialsSection job={job} confirmedByName={confirmer?.name} />
      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/jobs/${workNumber}/cutlist`} className={buttonVariants({ variant: "gold", className: "h-11 px-6" })}>
          Continue: cutlist →
        </Link>
        <Link href={`/admin/jobs/${workNumber}`} className={buttonVariants({ variant: "outline", className: "h-11" })}>
          Open the job instead
        </Link>
      </div>
    </>
  );
}
