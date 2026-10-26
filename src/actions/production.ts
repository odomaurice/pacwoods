"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/guards";
import {
  assignOperator,
  completeTask,
  pauseTask,
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

export async function assignOperatorAction(taskId: string, operatorId: string): Promise<ProductionResult> {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  return run(() => assignOperator({ id: user.id, role: user.role, permissions: user.permissions }, taskId, operatorId));
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
