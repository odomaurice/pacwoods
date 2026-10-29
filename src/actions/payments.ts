"use server";

import { revalidatePath } from "next/cache";
import type { ClientPaymentInput, OperatorPaymentInput } from "@/lib/payments";
import { requireRole } from "@/server/auth/guards";
import { recordClientPayment, recordOperatorPayment, voidPayment } from "@/server/services/payments";
import { ServiceError, type Actor } from "@/server/services/users";

export type PaymentResult = { ok: true } | { ok: false; error: string };

async function run(fn: (actor: Actor) => Promise<unknown>): Promise<PaymentResult> {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  try {
    await fn({ id: user.id, role: user.role, permissions: user.permissions });
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function recordClientPaymentAction(workNumber: string, input: ClientPaymentInput): Promise<PaymentResult> {
  return run((actor) => recordClientPayment(actor, workNumber, input));
}

export async function recordOperatorPaymentAction(taskId: string, input: OperatorPaymentInput): Promise<PaymentResult> {
  return run((actor) => recordOperatorPayment(actor, taskId, input));
}

export async function voidPaymentAction(paymentId: string, reason: string): Promise<PaymentResult> {
  return run((actor) => voidPayment(actor, paymentId, reason));
}
