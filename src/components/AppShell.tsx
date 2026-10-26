import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import { navigationFor } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/roles";
import type { SessionUser } from "@/server/auth/guards";

/** The signed-in frame for every role: sidebar navigation beside the page. */
export default function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <Sidebar sections={navigationFor(user)} userName={user.name} roleLabel={ROLE_LABELS[user.role]} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 print:p-0">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
