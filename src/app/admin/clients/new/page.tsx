import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { requireRole } from "@/server/auth/guards";
import ClientForm from "../ClientForm";

export const metadata: Metadata = { title: "Register client | Pacwoods" };

export default async function NewClientPage() {
  await requireRole("SUPER_ADMIN", "ADMIN");
  return (
    <>
      <PageHeader
        title="Register a client"
        description="A phone number is enough. The client gets a client number and a temporary password."
      />
      <ClientForm />
    </>
  );
}
