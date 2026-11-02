import type { Metadata } from "next";
import NewJobSection from "@/components/jobs/NewJobSection";
import PageHeader from "@/components/PageHeader";
import { requireRole } from "@/server/auth/guards";

export const metadata: Metadata = { title: "New job | Pacwoods" };

/** A new job in three steps: client and materials, job details, cutlist. */
export default async function NewJobPage() {
  await requireRole("SUPER_ADMIN", "ADMIN");
  return (
    <>
      <PageHeader title="New job" description="Who it is for and their boards, then the job, then the cutlist. The work number is assigned when you save." />
      <NewJobSection />
    </>
  );
}
