import type { Metadata } from "next";
import Link from "next/link";
import { listParams } from "@/components/ListControls";
import PageHeader from "@/components/PageHeader";
import StaffDirectory from "@/components/StaffDirectory";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Operators | Pacwoods" };

export default async function OperatorsPage({ searchParams }: PageProps<"/admin/operators">) {
  await requirePermission("operators.manage");
  const { q, page } = listParams(await searchParams);

  return (
    <>
      <PageHeader
        title="Operators"
        description="Workshop staff who cut and edge. Their capabilities decide which queues they can work."
        actions={
          <Link href="/admin/operators/new" className={buttonVariants()}>
            New operator
          </Link>
        }
      />
      <StaffDirectory role="OPERATOR" basePath="/admin/operators" q={q} page={page} />
    </>
  );
}
