import Link from "next/link";
import { formatPhone } from "@/lib/identity";
import EmptyState from "@/components/EmptyState";
import { Pagination, SearchForm, withParams } from "@/components/ListControls";
import { AccountStatusBadge } from "@/components/StatusBadge";
import ViewButton from "@/components/ViewButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Role } from "@/lib/roles";
import { listUsers } from "@/server/services/users";

const CAPABILITY_LABELS: Record<string, string> = { CUTTING: "Cutting", CNC: "CNC", EDGING: "Edging" };

/** Searchable, paginated list of Admin or Operator accounts. */
export default async function StaffDirectory({
  role,
  basePath,
  q,
  page,
}: {
  role: Extract<Role, "ADMIN" | "OPERATOR">;
  basePath: string;
  q: string;
  page: number;
}) {
  const { rows, total, pages } = await listUsers([role], { q, page });

  return (
    <>
      <SearchForm placeholder="Search by name, phone or email" q={q} />
      {rows.length === 0 ? (
        <EmptyState title={q ? "No accounts match that search." : "No accounts yet."} />
      ) : (
        <div className="rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>{role === "OPERATOR" ? "Capabilities" : "Permissions"}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u._id.toString()}>
                  <TableCell>
                    <Link href={`/admin/accounts/${u._id}`} className="font-medium underline-offset-4 hover:underline">
                      {u.name}
                    </Link>
                  </TableCell>
                  <TableCell>{formatPhone(u.phone) || "—"}</TableCell>
                  <TableCell>{u.email ?? "—"}</TableCell>
                  <TableCell>
                    {role === "OPERATOR"
                      ? u.capabilities.map((c) => CAPABILITY_LABELS[c]).join(", ")
                      : u.permissions.includes("operators.manage")
                        ? "Manages operators"
                        : "—"}
                  </TableCell>
                  <TableCell>
                    <AccountStatusBadge status={u.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ViewButton href={`/admin/accounts/${u._id}`} label={`View ${u.name}`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={page} pages={pages} total={total} href={(p) => withParams(basePath, { q, page: p })} />
    </>
  );
}
