import "server-only";
import mongoose from "mongoose";
import { ISSUE_CATEGORY_LABELS, issueReportSchema, issueResolutionSchema, type IssueReportInput, type IssueStatus } from "@/lib/issues";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { Issue } from "@/server/db/models/Issue";
import { Job } from "@/server/db/models/Job";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { User } from "@/server/db/models/User";
import { audit } from "@/server/services/audit";
import { PAGE_SIZE, ServiceError, type Actor } from "@/server/services/users";
import { recordJobEvent } from "@/server/workflow/transitions";

type Reporter = { id: string; role: string };

function parse(input: IssueReportInput) {
  const parsed = issueReportSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("INVALID", parsed.error.issues[0]?.message ?? "Check the report.");
  return parsed.data;
}

/** An operator reports a problem on work assigned to them. */
export async function reportIssueAsOperator(operator: Reporter, taskId: string, input: IssueReportInput) {
  if (operator.role !== "OPERATOR") throw new ServiceError("FORBIDDEN", "Only operators report production issues.");
  const data = parse(input);
  if (!mongoose.isValidObjectId(taskId)) throw new ServiceError("NOT_FOUND", "Task not found.");
  await connectDb();
  const task = await ProductionTask.findById(taskId).lean();
  if (!task || task.assignedOperatorId?.toString() !== operator.id) throw new ServiceError("FORBIDDEN", "This work is not assigned to you.");

  const issue = await Issue.create({
    jobId: task.jobId,
    workNumber: task.workNumber,
    taskId: task._id,
    reportedBy: operator.id,
    reporterRole: "OPERATOR",
    ...data,
  });
  await recordJobEvent(task.jobId, { type: "ISSUE_REPORTED", actorId: operator.id, note: `${ISSUE_CATEGORY_LABELS[data.category]}: ${data.description}`, clientVisible: false });
  return issue;
}

/** A client reports a problem on one of their own jobs. */
export async function reportIssueAsClient(client: Reporter, workNumber: string, input: IssueReportInput) {
  if (client.role !== "CLIENT") throw new ServiceError("FORBIDDEN", "Only clients can report on their jobs here.");
  const data = parse(input);
  await connectDb();
  const job = await Job.findOne({ workNumber }).select("clientId workNumber").lean();
  const owns = job && (await ClientProfile.exists({ _id: job.clientId, userId: client.id }));
  if (!job || !owns) throw new ServiceError("NOT_FOUND", "Job not found.");

  const issue = await Issue.create({ jobId: job._id, workNumber: job.workNumber, reportedBy: client.id, reporterRole: "CLIENT", ...data });
  await recordJobEvent(job._id, { type: "ISSUE_REPORTED", actorId: client.id, note: `Client reported: ${ISSUE_CATEGORY_LABELS[data.category]}`, clientVisible: true });
  return issue;
}

/** Staff close an issue with a note the reporter can read. */
export async function resolveIssue(actor: Actor, issueId: string, resolution: string) {
  if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") throw new ServiceError("FORBIDDEN", "Only staff resolve issues.");
  const text = issueResolutionSchema.safeParse(resolution);
  if (!text.success) throw new ServiceError("INVALID", text.error.issues[0].message);
  if (!mongoose.isValidObjectId(issueId)) throw new ServiceError("NOT_FOUND", "Issue not found.");
  await connectDb();
  const issue = await Issue.findOneAndUpdate(
    { _id: issueId, status: "OPEN" },
    { $set: { status: "RESOLVED", resolution: text.data, resolvedBy: actor.id, resolvedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!issue) throw new ServiceError("CONFLICT", "This issue is already resolved.");
  await recordJobEvent(issue.jobId, { type: "ISSUE_RESOLVED", actorId: actor.id, note: text.data, clientVisible: issue.reporterRole === "CLIENT" });
  await audit({ actorId: actor.id, action: "issue.resolved", targetType: "Issue", targetId: issue._id });
  return issue;
}

export async function countOpenIssues() {
  await connectDb();
  return Issue.countDocuments({ status: "OPEN" });
}

export async function listIssues({ status = "OPEN" as IssueStatus | "ALL", page = 1, jobId }: { status?: IssueStatus | "ALL"; page?: number; jobId?: mongoose.Types.ObjectId } = {}) {
  await connectDb();
  const filter: Record<string, unknown> = {};
  if (status !== "ALL") filter.status = status;
  if (jobId) filter.jobId = jobId;
  const [rows, total] = await Promise.all([
    Issue.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Issue.countDocuments(filter),
  ]);
  const people = await User.find({ _id: { $in: rows.flatMap((r) => [r.reportedBy, r.resolvedBy]).filter(Boolean) } }).select("name").lean();
  const names = new Map(people.map((p) => [p._id.toString(), p.name]));
  return {
    rows: rows.map((r) => ({ ...r, reporterName: names.get(r.reportedBy.toString()) ?? "Unknown", resolverName: r.resolvedBy ? names.get(r.resolvedBy.toString()) : undefined })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getIssue(issueId: string) {
  if (!mongoose.isValidObjectId(issueId)) return null;
  await connectDb();
  const issue = await Issue.findById(issueId).lean();
  if (!issue) return null;
  const people = await User.find({ _id: { $in: [issue.reportedBy, issue.resolvedBy].filter(Boolean) } }).select("name phone email role").lean();
  const byId = new Map(people.map((p) => [p._id.toString(), p]));
  return { issue, reporter: byId.get(issue.reportedBy.toString()), resolver: issue.resolvedBy ? byId.get(issue.resolvedBy.toString()) : undefined };
}

/** A client's own reports on one job, with any resolution note. */
export async function clientIssuesForJob(clientUserId: string, jobId: mongoose.Types.ObjectId) {
  await connectDb();
  return Issue.find({ jobId, reportedBy: clientUserId }).sort({ createdAt: -1 }).lean();
}
