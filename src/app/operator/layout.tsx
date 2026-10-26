import AppShell from "@/components/AppShell";
import { requireRole } from "@/server/auth/guards";

export default async function OperatorLayout({ children }: LayoutProps<"/operator">) {
  const user = await requireRole("OPERATOR");
  return (
    <AppShell user={user}>
      {children}
    </AppShell>
  );
}
