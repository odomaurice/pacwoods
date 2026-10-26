"use server";

import { revalidatePath } from "next/cache";
import type { IssueReportInput } from "@/lib/issues";
import { requireRole } from "@/server/auth/guards";
import { reportIssueAsClient, reportIssueAsOperator, resolveIssue } from "@/server/services/issues";
import { ServiceError } from "@/server/services/users";

export type IssueResult = { ok: true } | { ok: false; error: string };

async function run(fn: () => Promise<unknown>): Promise<IssueResult> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reportOperatorIssueAction(taskId: string, input: IssueReportInput): Promise<IssueResult> {
  const user = await requireRole("OPERATOR");
  return run(() => reportIssueAsOperator(user, taskId, input));
}

export async function reportClientIssueAction(workNumber: string, input: IssueReportInput): Promise<IssueResult> {
  const user = await requireRole("CLIENT");
  return run(() => reportIssueAsClient(user, workNumber, input));
}

export async function resolveIssueAction(issueId: string, resolution: string): Promise<IssueResult> {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  return run(() => resolveIssue({ id: user.id, role: user.role, permissions: user.permissions }, issueId, resolution));
}
