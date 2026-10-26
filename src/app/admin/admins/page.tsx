import type { Metadata } from "next";
import Link from "next/link";
import { listParams } from "@/components/ListControls";
import PageHeader from "@/components/PageHeader";
import StaffDirectory from "@/components/StaffDirectory";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Administrators | Pacwoods" };

export default async function AdminsPage({ searchParams }: PageProps<"/admin/admins">) {
  await requireRole("SUPER_ADMIN");
  const { q, page } = listParams(await searchParams);

  return (
    <>
      <PageHeader
        title="Administrators"
        description="Staff who register clients, configure jobs and run the queues."
        actions={
          <Link href="/admin/admins/new" className={buttonVariants()}>
            New administrator
          </Link>
        }
      />
      <StaffDirectory role="ADMIN" basePath="/admin/admins" q={q} page={page} />
    </>
  );
}
