import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ClientCard from "@/components/ClientCard";
import PrintButton from "@/components/PrintButton";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { getClient } from "@/server/services/users";

export const metadata: Metadata = { title: "Client card | Pacwoods" };

export default async function ClientCardPage({ params }: PageProps<"/admin/clients/[id]/card">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const { profile, user } = client;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 print:hidden">
        <Link href={`/admin/clients/${id}`} className={buttonVariants({ variant: "outline" })}>
          Back to client
        </Link>
        <PrintButton label="Print card" />
      </div>
      <ClientCard
        clientNumber={profile.clientNumber}
        name={user.name}
        businessName={profile.businessName}
        contact={user.phone ?? user.email}
      />
    </div>
  );
}
