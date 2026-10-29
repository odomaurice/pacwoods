/** Production stages and the queue rule, shared by server and UI. */
import { z } from "zod";

export const STAGES = ["CUTTING", "EDGING"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = { CUTTING: "Cutting", EDGING: "Edging" };

export const TASK_STATUSES = ["BLOCKED", "QUEUED", "IN_PROGRESS", "PAUSED", "COMPLETED", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  BLOCKED: "Waiting",
  QUEUED: "Queued",
  IN_PROGRESS: "In progress",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export type QueueItem = { id: string; workNumber: string; status: TaskStatus; queueSeq: number | null; stage: Stage };
export type Eligibility = { canStart: boolean; reason?: string };

/**
 * Which of the tasks an operator can see (open work nobody has taken, plus
 * their own) may be started now.
 *
 * - One task at a time: while one is in progress, nothing else starts.
 * - Per stage, first in, first out: only the earliest queued or paused task
 *   can be started (or resumed); later ones wait for it. Work another
 *   operator has taken is not in the list, so it never holds anyone up.
 * - Edging waits for its job's cutting to finish.
 */
export function eligibility(tasks: QueueItem[]): Map<string, Eligibility> {
  const result = new Map<string, Eligibility>();
  const active = tasks.find((t) => t.status === "IN_PROGRESS");

  for (const stage of new Set(tasks.map((t) => t.stage))) {
    const waiting = tasks
      .filter((t) => t.stage === stage && (t.status === "QUEUED" || t.status === "PAUSED"))
      .sort((a, b) => (a.queueSeq ?? Infinity) - (b.queueSeq ?? Infinity));
    const head = waiting[0];
    for (const t of waiting) {
      if (t !== head) result.set(t.id, { canStart: false, reason: head.status === "PAUSED" ? `Finish ${head.workNumber} first; you paused it and it is earlier in the queue.` : `Take ${head.workNumber} first; it is earlier in the queue.` });
      else if (active) result.set(t.id, { canStart: false, reason: `Finish or pause ${active.workNumber} first.` });
      else result.set(t.id, { canStart: true });
    }
  }
  for (const t of tasks) {
    if (t.status === "BLOCKED") {
      result.set(t.id, {
        canStart: false,
        reason: t.stage === "EDGING" ? "Waiting for cutting to finish." : "Not in the cutting queue yet: waiting for the cutlist to be approved and materials confirmed.",
      });
    }
    if (t.status === "IN_PROGRESS") result.set(t.id, { canStart: false, reason: "In progress." });
  }
  return result;
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}


const count = (label: string) => z.number({ error: `${label}: enter a number.` }).int(`${label} must be a whole number.`).min(0, `${label} cannot be negative.`).max(100000);

export const completionSchema = z.object({
  quantityCompleted: count("Panels completed"),
  wastePanels: count("Waste"),
  defectivePanels: count("Defective panels"),
  downtimeMin: count("Downtime").max(1440, "Downtime: at most 1440 minutes."),
  notes: z.string().trim().max(1000).optional(),
});
export type CompletionInput = z.infer<typeof completionSchema>;
