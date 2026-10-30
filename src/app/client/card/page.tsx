import type { Metadata } from "next";
import { formatPhone } from "@/lib/identity";
import ClientCard from "@/components/ClientCard";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import PrintButton from "@/components/PrintButton";
import { requireRole } from "@/server/auth/guards";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { User } from "@/server/db/models/User";

export const metadata: Metadata = { title: "My card | Pacwoods" };

export default async function MyCardPage() {
  const session = await requireRole("CLIENT");

  // Always the signed-in client's own card; nothing in the URL selects it.
  await connectDb();
  const [profile, user] = await Promise.all([
    ClientProfile.findOne({ userId: session.id }).lean(),
    User.findById(session.id).select("name phone email").lean(),
  ]);

  return (
    <>
      <PageHeader
        title="My client card"
        description="Show this at the Pacwoods counter so staff can find your account and jobs."
        actions={profile && <PrintButton label="Print card" />}
      />
      {profile && user ? (
        <ClientCard
          clientNumber={profile.clientNumber}
          name={user.name}
          businessName={profile.businessName}
          contact={formatPhone(user.phone) || user.email}
        />
      ) : (
        <EmptyState title="Your client card is not available. Please contact Pacwoods." />
      )}
    </>
  );
}
