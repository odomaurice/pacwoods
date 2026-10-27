import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobCard from "@/components/JobCard";
import PrintButton from "@/components/PrintButton";
import { buttonVariants } from "@/components/ui/button";
import { WORK_NUMBER_PATTERN } from "@/lib/numbers";
import { requireRole } from "@/server/auth/guards";
import { getJobCardData, scanUrl } from "@/server/services/jobCards";

export const metadata: Metadata = { title: "Job card | Pacwoods" };

export default async function StaffJobCardPage({ params }: PageProps<"/admin/jobs/[workNumber]/card">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { workNumber } = await params;
  if (!WORK_NUMBER_PATTERN.test(workNumber)) notFound();
  const found = await getJobCardData(workNumber);
  if (!found) notFound();

  return (
    <div className="space-y-6">
      <div className="flex gap-2 print:hidden">
        <Link href={`/admin/jobs/${workNumber}`} className={buttonVariants({ variant: "outline" })}>
          Back to job
        </Link>
        <PrintButton label="Print / save as PDF" />
      </div>
      <JobCard data={found.data} scanUrl={await scanUrl(found.qrToken)} audience="staff" />
    </div>
  );
}
