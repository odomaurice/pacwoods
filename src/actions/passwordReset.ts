"use server";

import { headers } from "next/headers";
import { newPasswordSchema } from "@/lib/password-policy";
import { completePasswordReset, requestPasswordReset } from "@/server/services/passwordReset";
import { ServiceError } from "@/server/services/users";

export type ResetResult = { ok: true } | { ok: false; error: string };

export async function requestResetAction(email: string): Promise<ResetResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    await requestPasswordReset(email, ip);
    return { ok: true };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function completeResetAction(token: string, password: string, confirm: string): Promise<ResetResult> {
  const parsed = newPasswordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (password !== confirm) return { ok: false, error: "The passwords do not match." };
  try {
    await completePasswordReset(token, parsed.data);
    return { ok: true };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
}
