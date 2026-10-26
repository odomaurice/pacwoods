import type { Metadata } from "next";
import EmptyState from "@/components/EmptyState";
import { requireRole } from "@/server/auth/guards";

export const metadata: Metadata = { title: "My jobs | Pacwoods" };

export default async function ClientJobs() {
  const user = await requireRole("CLIENT");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My jobs</h1>
        <p className="text-muted-foreground">Welcome, {user.name}.</p>
      </div>
      <EmptyState title="You have no jobs with Pacwoods yet." />
    </div>
  );
}
