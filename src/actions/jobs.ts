"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import type { JobDetailsInput, JobInput } from "@/lib/schemas";
import { confirmMaterials, createJob, updateDraftJob, withdrawMaterials } from "@/server/services/jobs";
import { ServiceError } from "@/server/services/users";

export type JobResult = { ok: false; error: string } | undefined;

async function staff() {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  return { id: user.id, role: user.role, permissions: user.permissions };
}

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof ServiceError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the form." };
  throw error;
}

export async function createJobAction(input: JobInput): Promise<{ ok: true; workNumber: string } | { ok: false; error: string }> {
  const actor = await staff();
  try {
    const { workNumber } = await createJob(actor, input);
    revalidatePath("/admin/jobs");
    return { ok: true, workNumber };
  } catch (error) {
    return failure(error);
  }
}

export async function updateJobAction(workNumber: string, input: JobDetailsInput): Promise<JobResult> {
  const actor = await staff();
  try {
    await updateDraftJob(actor, workNumber, input);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/jobs/${workNumber}`);
  redirect(`/admin/jobs/${workNumber}`);
}

export type MaterialResult = { ok: true } | { ok: false; error: string };

async function materialAction(workNumber: string, fn: (actor: Awaited<ReturnType<typeof staff>>) => Promise<void>): Promise<MaterialResult> {
  const actor = await staff();
  try {
    await fn(actor);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/jobs/${workNumber}`);
  revalidatePath("/admin/jobs");
  return { ok: true };
}

export async function confirmMaterialsAction(workNumber: string): Promise<MaterialResult> {
  return materialAction(workNumber, (actor) => confirmMaterials(actor, workNumber));
}

export async function withdrawMaterialsAction(workNumber: string, reason: string): Promise<MaterialResult> {
  return materialAction(workNumber, (actor) => withdrawMaterials(actor, workNumber, reason));
}
