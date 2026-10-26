import Link from "next/link";
import { JobStatusBadge } from "@/components/StatusBadge";
import ViewButton from "@/components/ViewButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { describeOperations } from "@/lib/jobs";
import type { JobRow } from "@/server/services/jobs";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export default function JobTable({ rows, showClient = true }: { rows: JobRow[]; showClient?: boolean }) {
  return (
    <div className="rounded-lg bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Work no.</TableHead>
            {showClient && <TableHead>Client</TableHead>}
            <TableHead>Title</TableHead>
            <TableHead>Operations</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((job) => (
            <TableRow key={job._id.toString()}>
              <TableCell>
                <Link href={`/admin/jobs/${job.workNumber}`} className="font-mono font-medium underline-offset-4 hover:underline">
                  {job.workNumber}
                </Link>
              </TableCell>
              {showClient && (
                <TableCell>
                  {job.client.businessName ?? job.client.name}
                  <span className="block font-mono text-xs text-muted-foreground">{job.client.clientNumber}</span>
                </TableCell>
              )}
              <TableCell>{job.title ?? "—"}</TableCell>
              <TableCell>{describeOperations(job.operations)}</TableCell>
              <TableCell>
                <JobStatusBadge status={job.status} />
              </TableCell>
              <TableCell>{dateFormat.format(job.createdAt)}</TableCell>
              <TableCell className="text-right">
                <ViewButton href={`/admin/jobs/${job.workNumber}`} label={`View ${job.workNumber}`} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
