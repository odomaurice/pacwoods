"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { changePasswordSchema, signInSchema, type ChangePasswordInput, type SignInInput } from "@/lib/password-policy";
import { roleHome } from "@/lib/roles";
import { requireUser } from "@/server/auth/guards";
import { ServiceError, changePassword } from "@/server/services/users";

export type ActionResult = { error: string } | undefined;

export async function signInAction(input: SignInInput): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter your phone number or email and password." };

  try {
    // Throws Next's redirect on success; "/" sends each role to its home.
    await signIn("credentials", { ...parsed.data, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = "code" in error ? error.code : undefined;
      return {
        error:
          code === "throttled"
            ? "Too many attempts. Wait 15 minutes and try again, or ask an administrator."
            : "Those details are not correct, or the account is not active.",
      };
    }
    throw error;
  }
}

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  const user = await requireUser({ allowPendingPasswordChange: true });
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  let identifier: string;
  try {
    ({ identifier } = await changePassword(
      user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    ));
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }

  // The change signed out every session, this one included; sign back in.
  await signIn("credentials", {
    identifier,
    password: parsed.data.newPassword,
    redirectTo: roleHome(user.role),
  });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
