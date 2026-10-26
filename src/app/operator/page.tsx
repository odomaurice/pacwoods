import type { Metadata } from "next";
import EmptyState from "@/components/EmptyState";
import { requireRole } from "@/server/auth/guards";

export const metadata: Metadata = { title: "My queue | Pacwoods" };

export default async function OperatorQueue() {
  await requireRole("OPERATOR");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My queue</h1>
      <EmptyState title="No work is waiting for you." />
    </div>
  );
}
