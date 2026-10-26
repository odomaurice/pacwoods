import AppShell from "@/components/AppShell";
import { requireRole } from "@/server/auth/guards";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  return (
    <AppShell user={user} nav={[{ href: "/admin", label: "Overview" }]}>
      {children}
    </AppShell>
  );
}
