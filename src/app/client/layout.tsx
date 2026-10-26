import AppShell from "@/components/AppShell";
import { requireRole } from "@/server/auth/guards";

export default async function ClientLayout({ children }: LayoutProps<"/client">) {
  const user = await requireRole("CLIENT");
  return (
    <AppShell user={user}>
      {children}
    </AppShell>
  );
}
