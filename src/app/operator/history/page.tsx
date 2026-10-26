import type { Metadata } from "next";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ViewButton from "@/components/ViewButton";
import { STAGE_LABELS, formatDuration } from "@/lib/production";
import { requireRole } from "@/server/auth/guards";
import { operatorHistory } from "@/server/services/production";

export const metadata: Metadata = { title: "History | Pacwoods" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function OperatorHistory() {
  const user = await requireRole("OPERATOR");
  const rows = await operatorHistory(user.id);

  return (
    <>
      <PageHeader title="History" description="Work you completed, with the actual time spent." />
      {rows.length === 0 ? (
        <EmptyState title="Nothing completed yet." />
      ) : (
        <div className="rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work no.</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="text-right">Panels</TableHead>
                <TableHead className="text-right">Time worked</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ task, activeMs }) => (
                <TableRow key={task._id.toString()}>
                  <TableCell className="font-mono">{task.workNumber}</TableCell>
                  <TableCell>{STAGE_LABELS[task.stage]}</TableCell>
                  <TableCell>{task.completedAt ? dateFormat.format(task.completedAt) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{task.results?.quantityCompleted ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDuration(activeMs)}</TableCell>
                  <TableCell className="text-right">
                    <ViewButton href={`/operator/tasks/${task._id}`} label={`View ${task.workNumber}`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
