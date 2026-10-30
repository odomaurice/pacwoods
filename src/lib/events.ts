/** Human wording for job timeline entries, shared by every timeline and feed. */
export const EVENT_LABELS: Record<string, string> = {
  JOB_CREATED: "Job registered",
  PLAN_GENERATED: "Cutting plan generated",
  CUTLIST_APPROVED: "Cutlist approved",
  CUTLIST_REOPENED: "Cutlist reopened for changes",
  MATERIAL_CONFIRMED: "Materials confirmed available",
  MATERIAL_WITHDRAWN: "Materials confirmation withdrawn",
  OPERATOR_ASSIGNED: "Operator assigned",
  TASK_RELEASED: "Released to the queue",
  PAYMENT_RECORDED: "Client payment recorded",
  MATERIAL_DETAILS: "Materials recorded",
  OPERATOR_PAID: "Operator paid",
  PAYMENT_VOIDED: "Payment entry voided",
  CUTTING_STARTED: "Cutting started",
  CUTTING_PAUSED: "Cutting paused",
  CUTTING_RESUMED: "Cutting resumed",
  CUTTING_COMPLETED: "Cutting completed",
  EDGING_STARTED: "Edging started",
  EDGING_PAUSED: "Edging paused",
  EDGING_RESUMED: "Edging resumed",
  EDGING_COMPLETED: "Edging completed",
  JOB_COMPLETED: "Job completed",
  ISSUE_REPORTED: "Issue reported",
  ISSUE_RESOLVED: "Issue resolved",
  MATERIAL_PHOTO_ADDED: "Photo of the wood added",
  FINISHED_PHOTO_ADDED: "Photo of finished work added",
};

export function eventLabel(type: string) {
  return EVENT_LABELS[type] ?? type.replaceAll("_", " ").toLowerCase();
}
