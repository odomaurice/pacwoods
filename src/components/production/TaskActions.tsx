"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeTaskAction, pauseTaskAction, startTaskAction } from "@/actions/production";
import ConfirmAction from "@/components/ConfirmAction";
import { ReportIssueButton } from "@/components/issues/IssueButtons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STAGE_LABELS, completionSchema, type Stage, type TaskStatus } from "@/lib/production";

type Props = {
  taskId: string;
  workNumber: string;
  stage: Stage;
  status: TaskStatus;
  canStart: boolean;
  reason?: string;
  totalPanels: number;
  /** In the queue list: only the start/resume control, details are on the job page. */
  startOnly?: boolean;
  /** Completion needs at least one photo of the finished work. */
  finishedPhotos?: number;
};

/**
 * The operator's controls for one task. Every action asks first, and the
 * server re-checks everything; a disabled button always says why.
 */
export default function TaskActions({ taskId, workNumber, stage, status, canStart, reason, totalPanels, startOnly = false, finishedPhotos = 0 }: Props) {
  const router = useRouter();
  const word = STAGE_LABELS[stage].toLowerCase();

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    const result = await action();
    if (result.ok) {
      toast.success(success);
      router.refresh();
      return true;
    }
    toast.error(result.error);
    return false;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(status === "QUEUED" || status === "PAUSED") && (
          <ConfirmAction
            large={!startOnly}
            disabled={!canStart}
            label={status === "PAUSED" ? `Resume ${word}` : `Start ${word}`}
            title={status === "PAUSED" ? `Resume ${word} for ${workNumber}?` : `Start ${word} for ${workNumber}?`}
            description={`This will mark the ${word} stage as in progress under your name.`}
            confirmLabel={status === "PAUSED" ? "Resume" : "Start"}
            onConfirm={() => run(() => startTaskAction(taskId), status === "PAUSED" ? "Work resumed." : "Work started.")}
          />
        )}
        {status === "IN_PROGRESS" && (
          <>
            <CompleteButton taskId={taskId} workNumber={workNumber} word={word} totalPanels={totalPanels} run={run} disabled={finishedPhotos === 0} />
            <PauseButton taskId={taskId} workNumber={workNumber} word={word} run={run} />
          </>
        )}
        {status !== "COMPLETED" && !startOnly && <ReportIssueButton large target={{ kind: "task", taskId }} workNumber={workNumber} />}
      </div>
      {!canStart && reason && status !== "IN_PROGRESS" && <p className={startOnly ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>{reason}</p>}
      {status === "IN_PROGRESS" && finishedPhotos === 0 && (
        <p className="text-sm font-medium text-brand-gold-deep">Add at least one photo of the finished work (below) before completing.</p>
      )}
    </div>
  );
}

type Run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) => Promise<boolean>;

function PauseButton({ taskId, workNumber, word, run }: { taskId: string; workNumber: string; word: string; run: Run }) {
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      large
      destructive
      label="Pause"
      title={`Pause ${word} for ${workNumber}?`}
      description={
        <span className="block space-y-2">
          <span className="block">The work stays unfinished and waits for you to resume it. It is not marked complete.</span>
          <span className="block space-y-1.5 text-left">
            <Label htmlFor="pause-reason">Reason</Label>
            <Textarea id="pause-reason" rows={2} placeholder="e.g. Blade change, machine fault, break" value={reason} onChange={(e) => setReason(e.target.value)} />
          </span>
        </span>
      }
      confirmLabel="Pause"
      onConfirm={() => run(() => pauseTaskAction(taskId, reason), "Work paused.")}
    />
  );
}

function CompleteButton({ taskId, workNumber, word, totalPanels, run, disabled }: { taskId: string; workNumber: string; word: string; totalPanels: number; run: Run; disabled: boolean }) {
  const [values, setValues] = useState({ quantityCompleted: String(totalPanels), wastePanels: "0", defectivePanels: "0", downtimeMin: "0", notes: "" });
  const field = (key: keyof typeof values, label: string) => (
    <span className="block space-y-1">
      <Label htmlFor={`c-${key}`}>{label}</Label>
      <Input id={`c-${key}`} inputMode="numeric" className="h-11" value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
    </span>
  );
  return (
    <ConfirmAction
      large
      disabled={disabled}
      label={`Complete ${word}`}
      title={`Complete ${word} for ${workNumber}?`}
      description={
        <span className="block space-y-3 text-left">
          <span className="block">Record what was done. Completing cannot be undone from here.</span>
          <span className="grid grid-cols-2 gap-3">
            {field("quantityCompleted", `Panels completed (of ${totalPanels})`)}
            {field("wastePanels", "Waste (panels)")}
            {field("defectivePanels", "Defective panels")}
            {field("downtimeMin", "Downtime (minutes)")}
          </span>
          <span className="block space-y-1">
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea id="c-notes" rows={2} value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} />
          </span>
        </span>
      }
      confirmLabel={`Complete ${word}`}
      onConfirm={async () => {
        const toNumber = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));
        const parsed = completionSchema.safeParse({
          quantityCompleted: toNumber(values.quantityCompleted),
          wastePanels: toNumber(values.wastePanels),
          defectivePanels: toNumber(values.defectivePanels),
          downtimeMin: toNumber(values.downtimeMin),
          notes: values.notes || undefined,
        });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Check the figures.");
          return false;
        }
        if (parsed.data.quantityCompleted < totalPanels && !parsed.data.notes) {
          toast.error("Fewer panels than planned: add a note explaining why.");
          return false;
        }
        return run(() => completeTaskAction(taskId, parsed.data), `${word[0].toUpperCase()}${word.slice(1)} completed.`);
      }}
    />
  );
}
