import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { Pagination, SearchForm, listParams, withParams } from "@/components/ListControls";
import PageHeader from "@/components/PageHeader";
import { AccountStatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/server/auth/guards";
import { listClients } from "@/server/services/users";

export const metadata: Metadata = { title: "Clients | Pacwoods" };

export default async function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { q, page } = listParams(await searchParams);
  const { rows, total, pages } = await listClients({ q, page });

  return (
    <>
      <PageHeader
        title="Clients"
        actions={
          <Link href="/admin/clients/new" className={buttonVariants()}>
            Register client
          </Link>
        }
      />
      <SearchForm placeholder="Search by name, business, phone or client number" q={q} />
      {rows.length === 0 ? (
        <EmptyState title={q ? "No clients match that search." : "No clients registered yet."} />
      ) : (
        <div className="rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client no.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c._id.toString()}>
                  <TableCell className="font-mono">{c.clientNumber}</TableCell>
                  <TableCell>
                    <Link href={`/admin/clients/${c._id}`} className="font-medium underline-offset-4 hover:underline">
                      {c.user.name}
                    </Link>
                  </TableCell>
                  <TableCell>{c.businessName ?? "—"}</TableCell>
                  <TableCell>{c.user.phone ?? c.user.email ?? "—"}</TableCell>
                  <TableCell>
                    <AccountStatusBadge status={c.user.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={page} pages={pages} total={total} href={(p) => withParams("/admin/clients", { q, page: p })} />
    </>
  );
}
