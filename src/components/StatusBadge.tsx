import { Badge } from "@/components/ui/badge";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/jobs";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/production";
import type { UserStatus } from "@/lib/schemas";

const ACCOUNT: Record<UserStatus, { label: string; variant: "secondary" | "destructive" | "outline" }> = {
  ACTIVE: { label: "Active", variant: "secondary" },
  SUSPENDED: { label: "Suspended", variant: "destructive" },
  DEACTIVATED: { label: "Deactivated", variant: "outline" },
};

export function AccountStatusBadge({ status }: { status: UserStatus }) {
  const { label, variant } = ACCOUNT[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const variant = status === "CANCELLED" || status === "ON_HOLD" ? "destructive" : status === "COMPLETED" ? "default" : "secondary";
  return <Badge variant={variant}>{JOB_STATUS_LABELS[status]}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const variant = status === "IN_PROGRESS" ? "default" : status === "PAUSED" || status === "CANCELLED" ? "destructive" : status === "COMPLETED" ? "outline" : "secondary";
  return <Badge variant={variant}>{TASK_STATUS_LABELS[status]}</Badge>;
}
