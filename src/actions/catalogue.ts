"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import type { MaterialInput } from "@/lib/schemas";
import { createMaterial, setMaterialActive } from "@/server/services/materials";
import { ServiceError } from "@/server/services/users";

export type MaterialResult = { ok: true } | { ok: false; error: string };

async function superAdmin() {
  const user = await requireRole("SUPER_ADMIN");
  return { id: user.id, role: user.role, permissions: user.permissions };
}

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof ServiceError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the form." };
  throw error;
}

export async function createMaterialAction(input: MaterialInput): Promise<MaterialResult> {
  const actor = await superAdmin();
  try {
    await createMaterial(actor, input);
    revalidatePath("/admin/materials");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setMaterialActiveAction(materialId: string, active: boolean): Promise<MaterialResult> {
  const actor = await superAdmin();
  try {
    await setMaterialActive(actor, materialId, active);
    revalidatePath("/admin/materials");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
