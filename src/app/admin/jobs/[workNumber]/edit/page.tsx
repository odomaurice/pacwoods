import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { WORK_NUMBER_PATTERN } from "@/lib/numbers";
import { requireRole } from "@/server/auth/guards";
import { getJobByWorkNumber } from "@/server/services/jobs";
import JobForm from "../../JobForm";

export const metadata: Metadata = { title: "Edit job | Pacwoods" };

export default async function EditJobPage({ params }: PageProps<"/admin/jobs/[workNumber]/edit">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { workNumber } = await params;
  if (!WORK_NUMBER_PATTERN.test(workNumber)) notFound();
  const found = await getJobByWorkNumber(workNumber);
  if (!found) notFound();
  const { job } = found;
  if (job.status !== "DRAFT") redirect(`/admin/jobs/${workNumber}`);

  return (
    <>
      <PageHeader title={`Edit ${job.workNumber}`} description="Only draft jobs can be edited." />
      <JobForm
        existing={{
          workNumber,
          values: {
            clientId: job.clientId.toString(),
            title: job.title ?? "",
            cutting: job.operations?.cutting ?? true,
            edging: job.operations?.edging ?? false,
            cnc: job.operations?.cnc ?? false,
            clientNotes: job.clientNotes ?? "",
            internalNotes: job.internalNotes ?? "",
          },
        }}
      />
    </>
  );
}
