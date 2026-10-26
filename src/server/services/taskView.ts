import "server-only";
import type { TaskDetailProps } from "@/components/production/TaskDetail";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { User } from "@/server/db/models/User";
import { getCutlists } from "@/server/services/cutlists";
import { activeMs, getTaskForViewer } from "@/server/services/production";

/** Everything the task page renders, after the viewer's access check. */
export async function loadTaskView(viewer: { id: string; role: string }, taskId: string) {
  const found = await getTaskForViewer(viewer, taskId);
  if (!found) return null;
  const { task, job, sessions, rule } = found;
  const [{ approved }, profile] = await Promise.all([getCutlists(job._id), ClientProfile.findById(job.clientId).lean()]);
  const clientUser = profile && (await User.findById(profile.userId).select("name").lean());

  const props: TaskDetailProps = {
    stage: task.stage,
    status: task.status,
    queueSeq: task.queueSeq,
    clientLabel: profile ? `${profile.businessName ?? clientUser?.name ?? ""} (${profile.clientNumber})` : "—",
    operations: job.operations ?? { cutting: true, edging: false },
    clientNotes: job.clientNotes,
    internalNotes: job.internalNotes,
    cutlist: approved,
    sessions,
    activeMs: activeMs(sessions),
    results: task.results,
  };
  const totalPanels = approved?.parts.reduce((n, p) => n + p.quantity, 0) ?? 0;
  return { task, job, rule, props, totalPanels };
}
