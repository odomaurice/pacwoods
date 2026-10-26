import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { requireRole } from "@/server/auth/guards";
import { listOperatorsFor } from "@/server/services/production";
import { listActiveClientOptions } from "@/server/services/users";
import JobForm from "../JobForm";

export const metadata: Metadata = { title: "New job | Pacwoods" };

export default async function NewJobPage({ searchParams }: PageProps<"/admin/jobs/new">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { client } = await searchParams;
  const [clients, cutters, edgers] = await Promise.all([listActiveClientOptions(), listOperatorsFor("CUTTING"), listOperatorsFor("EDGING")]);
  const asOptions = (ops: typeof cutters) => ops.map((o) => ({ id: o._id.toString(), name: o.name }));
  const defaultClientId = typeof client === "string" && clients.some((c) => c.id === client) ? client : undefined;

  return (
    <>
      <PageHeader
        title="New job"
        description="The work number is assigned when you save."
      />
      {clients.length === 0 ? (
        <EmptyState title="Register a client first.">
          <Link href="/admin/clients/new" className="underline underline-offset-4">
            Register a client
          </Link>
        </EmptyState>
      ) : (
        <JobForm clients={clients} defaultClientId={defaultClientId} cuttingOperators={asOptions(cutters)} edgingOperators={asOptions(edgers)} />
      )}
    </>
  );
}
