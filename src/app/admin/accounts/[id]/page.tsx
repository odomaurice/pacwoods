import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import AccountActions from "@/components/AccountActions";
import Detail from "@/components/Detail";
import PageHeader from "@/components/PageHeader";
import { AccountStatusBadge } from "@/components/StatusBadge";
import { ROLE_LABELS, canProvision } from "@/lib/roles";
import { requireRole } from "@/server/auth/guards";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { User } from "@/server/db/models/User";

export const metadata: Metadata = { title: "Account | Pacwoods" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Staff account detail: Admins and Operators. Clients have their own page. */
export default async function AccountPage({ params }: PageProps<"/admin/accounts/[id]">) {
  const actor = await requireRole("SUPER_ADMIN", "ADMIN");
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  await connectDb();
  const user = await User.findById(id).lean();
  if (!user || user.role === "SUPER_ADMIN") notFound();
  if (user.role === "CLIENT") {
    const profile = await ClientProfile.findOne({ userId: user._id }).select("_id").lean();
    if (profile) redirect(`/admin/clients/${profile._id}`);
    notFound();
  }
  if (!canProvision(actor, user.role)) redirect("/denied");

  const back = user.role === "ADMIN" ? { href: "/admin/admins", label: "Administrators" } : { href: "/admin/operators", label: "Operators" };

  return (
    <>
      <Link href={back.href} className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← {back.label}
      </Link>
      <PageHeader title={user.name} description={ROLE_LABELS[user.role]} />

      <dl className="mb-8 grid gap-4 rounded-lg bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Status">
          <AccountStatusBadge status={user.status} />
        </Detail>
        <Detail label="Phone">{user.phone ?? "—"}</Detail>
        <Detail label="Email">{user.email ?? "—"}</Detail>
        {user.role === "OPERATOR" && (
          <Detail label="Capabilities">{user.capabilities.map((c) => (c === "CUTTING" ? "Cutting" : "Edging")).join(", ")}</Detail>
        )}
        {user.role === "ADMIN" && (
          <Detail label="Permissions">
            {user.permissions.includes("operators.manage") ? "Manages operators" : "Standard"}
          </Detail>
        )}
        <Detail label="Password">{user.mustChangePassword ? "Temporary — not yet changed" : "Set by the user"}</Detail>
        <Detail label="Last sign-in">{user.lastLoginAt ? dateFormat.format(user.lastLoginAt) : "Never"}</Detail>
        <Detail label="Created">{dateFormat.format(user.createdAt)}</Detail>
      </dl>

      <h2 className="mb-3 text-lg font-semibold">Manage access</h2>
      <AccountActions
        userId={user._id.toString()}
        name={user.name}
        login={user.phone ?? user.email ?? ""}
        status={user.status}
      />
    </>
  );
}

