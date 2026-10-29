"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/guards";
import {
  completeTask,
  markCut,
  pauseTask,
  releaseTask,
  startTask,
  type CompletionInput,
} from "@/server/services/production";
import { ServiceError } from "@/server/services/users";

export type ProductionResult = { ok: true } | { ok: false; error: string };

async function run(fn: () => Promise<unknown>): Promise<ProductionResult> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/operator", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function releaseTaskAction(taskId: string): Promise<ProductionResult> {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  return run(() => releaseTask({ id: user.id, role: user.role, permissions: user.permissions }, taskId));
}

async function operator() {
  const user = await requireRole("OPERATOR");
  return { id: user.id, role: user.role };
}

export async function startTaskAction(taskId: string): Promise<ProductionResult> {
  const me = await operator();
  return run(() => startTask(me, taskId));
}

export async function pauseTaskAction(taskId: string, reason: string): Promise<ProductionResult> {
  const me = await operator();
  return run(() => pauseTask(me, taskId, reason));
}

export async function completeTaskAction(taskId: string, input: CompletionInput): Promise<ProductionResult> {
  const me = await operator();
  return run(() => completeTask(me, taskId, input));
}

/** Ticking a cut is frequent and only this operator sees it live, so nothing is revalidated. */
export async function markCutAction(taskId: string, key: string, done: boolean): Promise<ProductionResult> {
  const me = await operator();
  try {
    await markCut(me, taskId, key, done);
    return { ok: true };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
}
