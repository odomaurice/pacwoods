import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import StaffAccountForm from "@/components/StaffAccountForm";
import { requireRole } from "@/server/auth/guards";

export const metadata: Metadata = { title: "New administrator | Pacwoods" };

export default async function NewAdminPage() {
  await requireRole("SUPER_ADMIN");
  return (
    <>
      <PageHeader
        title="New administrator"
        description="They get a temporary password and must choose their own at first sign-in."
      />
      <StaffAccountForm role="ADMIN" backHref="/admin/admins" />
    </>
  );
}
