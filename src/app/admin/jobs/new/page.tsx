import type { Metadata } from "next";
import ClientForm from "@/app/admin/clients/ClientForm";
import ClientPicker from "@/components/jobs/ClientPicker";
import JobSteps from "@/components/jobs/JobSteps";
import PageHeader from "@/components/PageHeader";
import { requireRole } from "@/server/auth/guards";
import { listActiveClientOptions } from "@/server/services/users";
import JobForm from "../JobForm";

export const metadata: Metadata = { title: "New job | Pacwoods" };

/**
 * A new job, step by step. Step 1 finds the client, or registers them on the
 * spot; step 2 is the job itself. Saving it goes on to materials (step 3)
 * and then the cutlist (step 4).
 */
export default async function NewJobPage({ searchParams }: PageProps<"/admin/jobs/new">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { client } = await searchParams;
  const clients = await listActiveClientOptions();
  const chosen = typeof client === "string" ? clients.find((c) => c.id === client) : undefined;

  return (
    <>
      <PageHeader title="New job" description={chosen ? "Step 2: what the job is. The work number is assigned when you save." : "Step 1: who the job is for."} />
      <JobSteps current={chosen ? 2 : 1} />
      {chosen ? (
        <JobForm defaultClientId={chosen.id} chosenClient={chosen.label} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="existing" className="space-y-3">
            <h2 id="existing" className="text-lg font-semibold">
              An existing client
            </h2>
            {clients.length === 0 ? (
              <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">No clients yet. Register the first one.</p>
            ) : (
              <ClientPicker
                clients={clients.map((c) => ({ id: c.id, label: c.label, search: `${c.label} ${c.phone ?? ""} ${c.phone ? `0${c.phone.slice(4)}` : ""}`.toLowerCase().replace(/\s+/g, "") }))}
              />
            )}
          </section>
          <section aria-labelledby="new-client" className="space-y-3">
            <h2 id="new-client" className="text-lg font-semibold">
              Or a new client
            </h2>
            <div className="rounded-lg bg-card p-5">
              <ClientForm wizard />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
