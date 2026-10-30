export const JOB_STATUSES = [
  "DRAFT",
  "AWAITING_APPROVAL",
  "AWAITING_MATERIAL",
  "QUEUED_FOR_CUTTING",
  "CUTTING_IN_PROGRESS",
  "QUEUED_FOR_CNC",
  "CNC_IN_PROGRESS",
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
  QUEUED_FOR_CNC: "Queued for CNC",
  CNC_IN_PROGRESS: "CNC machining in progress",
  AWAITING_EDGING: "Awaiting edging",
  QUEUED_FOR_EDGING: "Queued for edging",
  EDGING_IN_PROGRESS: "Edging in progress",
  AWAITING_QUALITY_CHECK: "Awaiting quality check",
  COMPLETED: "Completed",
  ON_HOLD: "On hold",
  CANCELLED: "Cancelled",
};

/** What a job needs. `cnc` is absent on jobs created before CNC machining existed. */
export type Operations = { cutting: boolean; edging: boolean; cnc?: boolean | null };

export function describeOperations(ops: Operations | null | undefined): string {
  if (!ops) return "None";
  const names = [ops.cutting && "cutting", ops.cnc && "CNC", ops.edging && "edging"].filter(Boolean) as string[];
  if (names.length === 0) return "None";
  if (names.length === 1) return `${names[0][0].toUpperCase()}${names[0].slice(1)} only`;
  const text = `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return text[0].toUpperCase() + text.slice(1);
}
