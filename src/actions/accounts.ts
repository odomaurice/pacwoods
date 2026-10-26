"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  accountActionSchema,
  clientAccountSchema,
  staffAccountSchema,
  type AccountActionInput,
  type ClientAccountInput,
  type StaffAccountInput,
} from "@/lib/schemas";
import { requireRole } from "@/server/auth/guards";
import {
  ServiceError,
  provisionAccount,
  provisionClient,
  resetPassword,
  revokeSessions,
  setUserStatus,
  type Actor,
} from "@/server/services/users";

export type CreatedAccount =
  | { ok: true; name: string; login: string; temporaryPassword: string; clientNumber?: string; clientId?: string }
  | { ok: false; error: string };

export type AccountActionResult =
  | { ok: true; message: string; temporaryPassword?: string }
  | { ok: false; error: string };

async function staffActor(): Promise<Actor> {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  return { id: user.id, role: user.role, permissions: user.permissions };
}

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof ServiceError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the form." };
  throw error;
}

export async function createStaffAccountAction(input: StaffAccountInput): Promise<CreatedAccount> {
  const actor = await staffActor();
  try {
    const data = staffAccountSchema.parse(input);
    const { user, temporaryPassword } = await provisionAccount(actor, data);
    revalidatePath(data.role === "ADMIN" ? "/admin/admins" : "/admin/operators");
    return { ok: true, name: user.name, login: user.phone ?? user.email!, temporaryPassword };
  } catch (error) {
    return failure(error);
  }
}

export async function createClientAction(input: ClientAccountInput): Promise<CreatedAccount> {
  const actor = await staffActor();
  try {
    const data = clientAccountSchema.parse(input);
    const { user, temporaryPassword, profile } = await provisionClient(actor, data);
    revalidatePath("/admin/clients");
    return {
      ok: true,
      name: user.name,
      login: user.phone ?? user.email!,
      temporaryPassword,
      clientNumber: profile.clientNumber,
      clientId: profile._id.toString(),
    };
  } catch (error) {
    return failure(error);
  }
}

/** Suspend / reactivate / deactivate, reset password, sign out everywhere. */
export async function accountAction(input: AccountActionInput): Promise<AccountActionResult> {
  const actor = await staffActor();
  try {
    const data = accountActionSchema.parse(input);
    let result: AccountActionResult;
    if (data.kind === "status") {
      await setUserStatus(actor, data.userId, data.status);
      const verb = { ACTIVE: "reactivated", SUSPENDED: "suspended", DEACTIVATED: "deactivated" }[data.status];
      result = { ok: true, message: `Account ${verb}.` };
    } else if (data.kind === "reset") {
      const { temporaryPassword } = await resetPassword(actor, data.userId);
      result = { ok: true, message: "Password reset.", temporaryPassword };
    } else {
      await revokeSessions(actor, data.userId);
      result = { ok: true, message: "Signed out of every device." };
    }
    revalidatePath("/admin", "layout");
    return result;
  } catch (error) {
    return failure(error);
  }
}
