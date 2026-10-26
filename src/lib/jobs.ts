export const JOB_STATUSES = [
  "DRAFT",
  "AWAITING_APPROVAL",
  "AWAITING_MATERIAL",
  "QUEUED_FOR_CUTTING",
  "CUTTING_IN_PROGRESS",
  "AWAITING_EDGING",
  "QUEUED_FOR_EDGING",
  "EDGING_IN_PROGRESS",
  "AWAITING_QUALITY_CHECK",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: "Draft",
  AWAITING_APPROVAL: "Awaiting approval",
  AWAITING_MATERIAL: "Awaiting material",
  QUEUED_FOR_CUTTING: "Queued for cutting",
  CUTTING_IN_PROGRESS: "Cutting in progress",
  AWAITING_EDGING: "Awaiting edging",
  QUEUED_FOR_EDGING: "Queued for edging",
  EDGING_IN_PROGRESS: "Edging in progress",
  AWAITING_QUALITY_CHECK: "Awaiting quality check",
  COMPLETED: "Completed",
  ON_HOLD: "On hold",
  CANCELLED: "Cancelled",
};

export type Operations = { cutting: boolean; edging: boolean };

export function describeOperations(ops: Operations | null | undefined): string {
  if (!ops) return "None";
  if (ops.cutting && ops.edging) return "Cutting and edging";
  if (ops.cutting) return "Cutting only";
  if (ops.edging) return "Edging only";
  return "None";
}
