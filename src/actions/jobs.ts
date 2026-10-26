"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import type { JobDetailsInput, JobInput } from "@/lib/schemas";
import { createJob, updateDraftJob } from "@/server/services/jobs";
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

export async function createJobAction(input: JobInput): Promise<JobResult> {
  const actor = await staff();
  let workNumber: string;
  try {
    ({ workNumber } = await createJob(actor, input));
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin/jobs");
  redirect(`/admin/jobs/${workNumber}`);
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
