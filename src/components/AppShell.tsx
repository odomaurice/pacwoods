import type { ReactNode } from "react";
import OfflineBar from "@/components/offline/OfflineBar";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import { navigationFor, tabsFor } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/roles";
import type { SessionUser } from "@/server/auth/guards";
import { countOpenIssues } from "@/server/services/issues";
import { unreadCount } from "@/server/services/notifications";

/** The signed-in frame for every role: a sidebar on large screens, app-style top and tab bars on phones. */
export default async function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const staff = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
  const [openIssues, unread] = await Promise.all([staff ? countOpenIssues() : 0, unreadCount(user.id)]);
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <Sidebar sections={navigationFor(user, { openIssues, unread })} tabs={tabsFor(user, { unread })} userName={user.name} roleLabel={ROLE_LABELS[user.role]} />
      {/* Room at the bottom for the phone tab bar and the home indicator on newer phones. */}
      <main className="min-w-0 flex-1 px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:px-8 sm:pt-8 lg:pb-8 print:p-0">
        <div className="mx-auto max-w-6xl">
          <OfflineBar userId={user.id} />
          {children}
        </div>
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
