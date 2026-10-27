import { redirect } from "next/navigation";
import { roleHome } from "@/lib/roles";
import { getSessionUser } from "@/server/auth/guards";

/** Where sign-in lands: each role's own home, or the forced password change. */
export default async function Dashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(user.mustChangePassword ? "/change-password" : roleHome(user.role));
}
