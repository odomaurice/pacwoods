"use server";

import { revalidatePath } from "next/cache";
import type { CutlistInput } from "@/lib/cutlist";
import { requireRole } from "@/server/auth/guards";
import { approveCutlist, generatePlan, reopenCutlist, saveCutlistDraft } from "@/server/services/cutlists";
import { ServiceError } from "@/server/services/users";

export type CutlistResult = { ok: true } | { ok: false; error: string };

async function staff() {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  return { id: user.id, role: user.role, permissions: user.permissions };
}

async function run(workNumber: string, fn: () => Promise<unknown>): Promise<CutlistResult> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath(`/admin/jobs/${workNumber}`, "layout");
  return { ok: true };
}

export async function saveCutlistAction(workNumber: string, input: CutlistInput): Promise<CutlistResult> {
  const actor = await staff();
  return run(workNumber, () => saveCutlistDraft(actor, workNumber, input));
}

export async function generatePlanAction(workNumber: string, input: CutlistInput): Promise<CutlistResult> {
  const actor = await staff();
  return run(workNumber, () => generatePlan(actor, workNumber, input));
}

export async function approveCutlistAction(workNumber: string): Promise<CutlistResult> {
  const actor = await staff();
  return run(workNumber, () => approveCutlist(actor, workNumber));
}

export async function reopenCutlistAction(workNumber: string, reason: string): Promise<CutlistResult> {
  const actor = await staff();
  return run(workNumber, () => reopenCutlist(actor, workNumber, reason));
}
