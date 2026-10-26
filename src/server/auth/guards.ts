import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/lib/roles";

export type SessionUser = {
  id: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
};

/** The signed-in user for this request, or null. Re-validated against the DB. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  return session?.user?.id ? session.user : null;
});

/**
 * Every page, server action and route handler calls one of these itself.
 * Layouts and the proxy are conveniences, not the security boundary.
 */
export async function requireUser(
  { allowPendingPasswordChange = false } = {},
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !allowPendingPasswordChange) redirect("/change-password");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/denied");
  return user;
}
