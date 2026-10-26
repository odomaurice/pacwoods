import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import StaffAccountForm from "@/components/StaffAccountForm";
import { requirePermission } from "@/server/auth/guards";

export const metadata: Metadata = { title: "New operator | Pacwoods" };

export default async function NewOperatorPage() {
  await requirePermission("operators.manage");
  return (
    <>
      <PageHeader
        title="New operator"
        description="Choose what they can do. Someone with both can cut and edge, one stage at a time."
      />
      <StaffAccountForm role="OPERATOR" backHref="/admin/operators" />
    </>
  );
}
