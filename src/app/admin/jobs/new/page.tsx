import type { Metadata } from "next";
import NewJobSection from "@/components/jobs/NewJobSection";
import PageHeader from "@/components/PageHeader";
import { requireRole } from "@/server/auth/guards";

export const metadata: Metadata = { title: "New job | Pacwoods" };

/** Where Admins land after signing in: the client, then the job and its materials, then the cutlist. */
export default async function NewJobPage() {
  await requireRole("SUPER_ADMIN", "ADMIN");
  return (
    <>
      <PageHeader title="New job" description="The client, then the job with its materials, then the cutlist. The work number is assigned when you save the job." />
      <NewJobSection />
    </>
  );
}
