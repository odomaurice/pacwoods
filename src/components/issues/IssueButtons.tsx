"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reportClientIssueAction, reportOperatorIssueAction, resolveIssueAction } from "@/actions/issues";
import ConfirmAction from "@/components/ConfirmAction";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ISSUE_CATEGORIES, ISSUE_CATEGORY_LABELS, issueReportSchema, type IssueCategory } from "@/lib/issues";

type Target = { kind: "task"; taskId: string } | { kind: "job"; workNumber: string };

/** "Report a problem" for operators (on a task) and clients (on their job). */
export function ReportIssueButton({ target, workNumber, large = false }: { target: Target; workNumber: string; large?: boolean }) {
  const router = useRouter();
  const [category, setCategory] = useState<IssueCategory>("OTHER");
  const [description, setDescription] = useState("");

  return (
    <ConfirmAction
      large={large}
      label="Report a problem"
      title={`Report a problem with ${workNumber}`}
      description={
        <span className="block space-y-3 text-left">
          <span className="block space-y-1.5">
            <Label htmlFor="issue-category">What kind of problem?</Label>
            <select
              id="issue-category"
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
              value={category}
              onChange={(e) => setCategory(e.target.value as IssueCategory)}
            >
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ISSUE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </span>
          <span className="block space-y-1.5">
            <Label htmlFor="issue-description">Describe it</Label>
            <Textarea id="issue-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </span>
          <span className="block text-xs">Pacwoods staff will see this and reply when it is resolved.</span>
        </span>
      }
      confirmLabel="Send report"
      onConfirm={async () => {
        const input = issueReportSchema.safeParse({ category, description });
        if (!input.success) {
          toast.error(input.error.issues[0]?.message ?? "Check the report.");
          return false;
        }
        const result =
          target.kind === "task" ? await reportOperatorIssueAction(target.taskId, input.data) : await reportClientIssueAction(target.workNumber, input.data);
        if (!result.ok) {
          toast.error(result.error);
          return false;
        }
        toast.success("Problem reported. Staff have been told.");
        setDescription("");
        router.refresh();
        return true;
      }}
    />
  );
}

export function ResolveIssueButton({ issueId, workNumber }: { issueId: string; workNumber: string }) {
  const router = useRouter();
  const [resolution, setResolution] = useState("");
  return (
    <ConfirmAction
      label="Resolve issue"
      title={`Resolve this issue on ${workNumber}?`}
      description={
        <span className="block space-y-1.5 text-left">
          <Label htmlFor="resolution">How was it resolved? (the reporter sees this)</Label>
          <Textarea id="resolution" rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} />
        </span>
      }
      confirmLabel="Mark resolved"
      onConfirm={async () => {
        const result = await resolveIssueAction(issueId, resolution);
        if (!result.ok) {
          toast.error(result.error);
          return false;
        }
        toast.success("Issue resolved.");
        router.refresh();
        return true;
      }}
    />
  );
}
