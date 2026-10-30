"use server";

import { revalidatePath } from "next/cache";
import type { CutlistInput } from "@/lib/cutlist";
import { UNPLACED_REASONS } from "@/lib/plan-text";
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

export type PlanSummary = {
  sheets: number;
  utilization: number;
  placed: number;
  requested: number;
  unplaced: Array<{ label: string; copies: number; reason: string }>;
};

export async function generatePlanAction(workNumber: string, input: CutlistInput): Promise<{ ok: true; summary: PlanSummary } | { ok: false; error: string }> {
  const actor = await staff();
  let summary: PlanSummary | undefined;
  const result = await run(workNumber, async () => {
    const draft = await generatePlan(actor, workNumber, input);
    const plan = draft.plan!;
    const label = (ref: string) => input.parts.find((p) => p.ref === ref)?.label || ref;
    const grouped = new Map<string, { label: string; copies: number; reason: string }>();
    for (const u of plan.unplaced) {
      const key = `${u.partRef}|${u.reason}`;
      const g = grouped.get(key) ?? { label: label(u.partRef), copies: 0, reason: UNPLACED_REASONS[u.reason] };
      g.copies++;
      grouped.set(key, g);
    }
    summary = { sheets: plan.totals.sheetsUsed, utilization: plan.totals.utilization, placed: plan.totals.partsPlaced, requested: plan.totals.partsRequested, unplaced: [...grouped.values()] };
  });
  return result.ok ? { ok: true, summary: summary! } : result;
}

export async function approveCutlistAction(workNumber: string): Promise<CutlistResult> {
  const actor = await staff();
  return run(workNumber, () => approveCutlist(actor, workNumber));
}

export async function reopenCutlistAction(workNumber: string, reason: string): Promise<CutlistResult> {
  const actor = await staff();
  return run(workNumber, () => reopenCutlist(actor, workNumber, reason));
}
