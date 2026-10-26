import "server-only";
import type { Types } from "mongoose";
import { AuditLog } from "@/server/db/models/AuditLog";

export type AuditEntry = {
  actorId?: Types.ObjectId | string;
  action: string;
  targetType?: string;
  targetId?: Types.ObjectId | string;
  meta?: Record<string, unknown>;
  ip?: string;
};

export async function audit(entry: AuditEntry): Promise<void> {
  await AuditLog.create(entry);
}
