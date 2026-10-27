import type { Metadata } from "next";
import mongoose from "mongoose";
import EmptyState from "@/components/EmptyState";
import { Pagination, listParams, withParams } from "@/components/ListControls";
import PageHeader from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/server/auth/guards";
import { connectDb } from "@/server/db/connect";
import { AuditLog } from "@/server/db/models/AuditLog";
import { User } from "@/server/db/models/User";

export const metadata: Metadata = { title: "Audit log | Pacwoods" };

const PAGE_SIZE = 50;
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" });

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in",
  "user.created": "Account created",
  "user.bootstrap_super_admin": "First Super Admin created",
  "user.password_changed": "Password changed",
  "user.password_reset": "Password reset",
  "user.sessions_revoked": "Signed out everywhere",
  "user.suspended": "Account suspended",
  "user.reactivated": "Account reactivated",
  "user.deactivated": "Account deactivated",
  "material.created": "Material added",
  "material.retired": "Material retired",
  "material.activated": "Material restored",
  "job.created": "Job created",
  "job.updated": "Job updated",
  "settings.updated": "Settings changed",
  "user.password_reset_requested": "Password reset requested",
  "user.password_reset_completed": "Password reset by email",
  "cutlist.approved": "Cutlist approved",
  "cutlist.reopened": "Cutlist reopened",
  "task.assigned": "Operator assigned",
  "issue.resolved": "Issue resolved",
  "photo.deleted": "Photo removed",
  "job.material_confirmed": "Materials confirmed",
  "job.material_withdrawn": "Materials withdrawn",
  "material.standard_added": "Standard materials added",
};

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireRole("SUPER_ADMIN");
  const { page } = listParams(await searchParams);

  await connectDb();
  const [entries, total] = await Promise.all([
    AuditLog.find().sort({ at: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    AuditLog.estimatedDocumentCount(),
  ]);
  const ids = new Set<string>();
  for (const e of entries) {
    if (e.actorId) ids.add(e.actorId.toString());
    if (e.targetType === "User" && e.targetId) ids.add(e.targetId.toString());
  }
  const users = await User.find({ _id: { $in: [...ids].map((id) => new mongoose.Types.ObjectId(id)) } })
    .select("name")
    .lean();
  const names = new Map(users.map((u) => [u._id.toString(), u.name]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Audit log" description="Every sensitive action, newest first. Entries cannot be edited." />
      {entries.length === 0 ? (
        <EmptyState title="Nothing recorded yet." />
      ) : (
        <div className="rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e._id.toString()}>
                  <TableCell className="whitespace-nowrap">{dateFormat.format(e.at)}</TableCell>
                  <TableCell>{e.actorId ? (names.get(e.actorId.toString()) ?? "Unknown") : "System"}</TableCell>
                  <TableCell>{ACTION_LABELS[e.action] ?? e.action}</TableCell>
                  <TableCell>
                    {e.targetType === "User" && e.targetId ? (names.get(e.targetId.toString()) ?? "—") : (e.targetType ?? "—")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.meta ? Object.entries(e.meta as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(", ") : ""}
                    {e.ip ? `${e.meta ? " · " : ""}IP ${e.ip}` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={page} pages={pages} total={total} href={(p) => withParams("/admin/audit", { page: p })} />
    </>
  );
}
