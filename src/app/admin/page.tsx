import type { Metadata } from "next";
import EmptyState from "@/components/EmptyState";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { requireRole } from "@/server/auth/guards";
import { connectDb } from "@/server/db/connect";
import { User } from "@/server/db/models/User";

export const metadata: Metadata = { title: "Overview | Pacwoods" };

export default async function AdminOverview() {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");

  await connectDb();
  const rows = await User.aggregate<{ _id: Role; count: number }>([
    { $match: { status: "ACTIVE" } },
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(rows.map((r) => [r._id, r.count]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-muted-foreground">Signed in as {user.name}.</p>
      </div>

      <section aria-labelledby="accounts" className="space-y-3">
        <h2 id="accounts" className="text-lg font-semibold">
          Active accounts
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ROLES.map((role) => (
            <div key={role} className="rounded-lg bg-card px-4 py-3">
              <dt className="text-sm text-muted-foreground">{ROLE_LABELS[role]}</dt>
              <dd className="text-2xl font-semibold">{counts[role] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="jobs" className="space-y-3">
        <h2 id="jobs" className="text-lg font-semibold">
          Jobs
        </h2>
        <EmptyState title="No jobs yet." />
      </section>
    </div>
  );
}
