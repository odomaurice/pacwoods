import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobCard from "@/components/JobCard";
import PrintButton from "@/components/PrintButton";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { getJobCardData, scanUrl } from "@/server/services/jobCards";
import { getTaskForViewer } from "@/server/services/production";

export const metadata: Metadata = { title: "Job card | Pacwoods" };

/** Printable job card for work this operator can see. */
export default async function OperatorJobCardPage({ params }: PageProps<"/operator/tasks/[id]/card">) {
  const user = await requireRole("OPERATOR");
  const { id } = await params;
  const found = await getTaskForViewer(user, id);
  if (!found) notFound();
  const card = await getJobCardData(found.task.workNumber);
  if (!card) notFound();

  return (
    <div className="space-y-6">
      <div className="flex gap-2 print:hidden">
        <Link href={`/operator/tasks/${id}`} className={buttonVariants({ variant: "outline" })}>
          Back to job
        </Link>
        <PrintButton label="Print / save as PDF" />
      </div>
      <JobCard data={card.data} scanUrl={await scanUrl(card.qrToken)} audience="staff" />
    </div>
  );
}
