"use server";

import { revalidatePath } from "next/cache";
import type { Settings } from "@/lib/settings";
import { requireRole } from "@/server/auth/guards";
import { updateSettings } from "@/server/services/settings";
import { ServiceError } from "@/server/services/users";

export async function saveSettingsAction(input: Settings): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRole("SUPER_ADMIN");
  try {
    await updateSettings({ id: user.id, role: user.role, permissions: user.permissions }, input);
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
