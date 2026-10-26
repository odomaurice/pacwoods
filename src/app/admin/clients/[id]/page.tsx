import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AccountActions from "@/components/AccountActions";
import Detail from "@/components/Detail";
import EmptyState from "@/components/EmptyState";
import JobTable from "@/components/JobTable";
import PageHeader from "@/components/PageHeader";
import { AccountStatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { listJobs } from "@/server/services/jobs";
import { getClient } from "@/server/services/users";

export const metadata: Metadata = { title: "Client | Pacwoods" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function ClientPage({ params }: PageProps<"/admin/clients/[id]">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const { profile, user } = client;
  const jobs = await listJobs({ clientId: id });

  return (
    <>
      <Link href="/admin/clients" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Clients
      </Link>
      <PageHeader
        title={profile.businessName ?? user.name}
        description={<span className="font-mono">{profile.clientNumber}</span>}
        actions={
          <>
            <Link href={`/admin/clients/${id}/card`} className={buttonVariants({ variant: "outline" })}>
              Client card
            </Link>
            {user.status === "ACTIVE" && (
              <Link href={`/admin/jobs/new?client=${id}`} className={buttonVariants()}>
                New job
              </Link>
            )}
          </>
        }
      />

      <dl className="mb-8 grid gap-4 rounded-lg bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Contact">{user.name}</Detail>
        <Detail label="Phone">{user.phone ?? "—"}</Detail>
        <Detail label="Email">{user.email ?? "—"}</Detail>
        <Detail label="Status">
          <AccountStatusBadge status={user.status} />
        </Detail>
        <Detail label="Password">{user.mustChangePassword ? "Temporary — not yet changed" : "Set by the client"}</Detail>
        <Detail label="Registered">{dateFormat.format(profile.createdAt)}</Detail>
        {profile.address && <Detail label="Address">{profile.address}</Detail>}
        {profile.staffNotes && <Detail label="Staff notes">{profile.staffNotes}</Detail>}
      </dl>

      <section className="mb-8 space-y-3">
        <h2 className="text-lg font-semibold">Jobs</h2>
        {jobs.rows.length === 0 ? <EmptyState title="No jobs for this client yet." /> : <JobTable rows={jobs.rows} showClient={false} />}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Manage access</h2>
        <AccountActions
          userId={user._id.toString()}
          name={user.name}
          login={user.phone ?? user.email ?? ""}
          status={user.status}
        />
      </section>
    </>
  );
}
