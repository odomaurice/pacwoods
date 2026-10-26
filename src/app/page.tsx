import { redirect } from "next/navigation";
import { roleHome } from "@/lib/roles";
import { getSessionUser } from "@/server/auth/guards";

/** The root sends everyone where they belong: sign-in, or their role's home. */
export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(user.mustChangePassword ? "/change-password" : roleHome(user.role));
}
