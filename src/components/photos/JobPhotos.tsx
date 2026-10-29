import type { Types } from "mongoose";
import { PhotoGrid, PhotoUploader, type GridPhoto } from "@/components/photos/PhotoControls";
import { MAX_PHOTOS, PHOTO_KIND_LABELS } from "@/lib/photos";
import { STAGE_LABELS, type Stage } from "@/lib/production";
import { connectDb } from "@/server/db/connect";
import { Job } from "@/server/db/models/Job";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { capabilitiesOf, operatorCanSee } from "@/server/services/production";
import { User } from "@/server/db/models/User";
import { listPhotos } from "@/server/services/photos";

type Viewer = { id: string; role: string };

const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/**
 * A job's photos for any viewer: the wood as received, and finished work per
 * stage. What the viewer may add or remove follows the same rules the server
 * enforces on upload and delete.
 */
export default async function JobPhotos({ jobId, viewer, title = "Photos" }: { jobId: Types.ObjectId; viewer: Viewer; title?: string }) {
  await connectDb();
  const [job, photos, tasks] = await Promise.all([
    Job.findById(jobId).select("workNumber status").lean(),
    listPhotos(jobId),
    ProductionTask.find({ jobId }).select("stage status assignedOperatorId completedBy").lean(),
  ]);
  if (!job) return null;
  const people = await User.find({ _id: { $in: photos.map((p) => p.uploadedBy) } }).select("name").lean();
  const name = new Map(people.map((p) => [p._id.toString(), p.name]));

  const staff = viewer.role === "SUPER_ADMIN" || viewer.role === "ADMIN";
  const open = job.status !== "COMPLETED" && job.status !== "CANCELLED";
  const capabilities = viewer.role === "OPERATOR" ? await capabilitiesOf(viewer.id) : [];
  const onJob = viewer.role === "OPERATOR" && tasks.some((t) => operatorCanSee(t, { id: viewer.id, capabilities }));
  const taskOpen = (t: (typeof tasks)[number]) => t.status !== "COMPLETED" && t.status !== "CANCELLED";

  const grid = (list: typeof photos): GridPhoto[] =>
    list.map((p) => {
      const task = p.taskId ? tasks.find((t) => t._id.equals(p.taskId!)) : undefined;
      const locked = task?.status === "COMPLETED" || !open;
      return {
        id: p._id.toString(),
        at: when.format(p.createdAt),
        uploader: name.get(p.uploadedBy.toString()),
        canDelete: !locked && viewer.role !== "CLIENT" && (staff || p.uploadedBy.toString() === viewer.id),
      };
    });

  const material = photos.filter((p) => p.kind === "MATERIAL");
  const canAddMaterial = open && (staff || (viewer.role === "OPERATOR" && onJob)) && material.length < MAX_PHOTOS;

  return (
    <section aria-label={title} className="space-y-5 rounded-lg bg-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-medium">{PHOTO_KIND_LABELS.MATERIAL}</h3>
          <span className="text-sm text-muted-foreground">{material.length}</span>
          {canAddMaterial && (
            <span className="ml-auto">
              <PhotoUploader workNumber={job.workNumber} kind="MATERIAL" label="Add wood photos" />
            </span>
          )}
        </div>
        <PhotoGrid photos={grid(material)} emptyText="No photos of the wood yet." />
      </div>

      {tasks
        .sort((a, b) => a.stage.localeCompare(b.stage) * -1)
        .map((t) => {
          const finished = photos.filter((p) => p.kind === "FINISHED" && p.taskId?.equals(t._id));
          const mine = t.assignedOperatorId?.toString() === viewer.id;
          const canAdd = taskOpen(t) && (staff || mine) && finished.length < MAX_PHOTOS;
          return (
            <div key={t._id.toString()} className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-medium">
                  {PHOTO_KIND_LABELS.FINISHED} · {STAGE_LABELS[t.stage as Stage]}
                </h3>
                <span className="text-sm text-muted-foreground">{finished.length}</span>
                {canAdd && (
                  <span className="ml-auto">
                    <PhotoUploader workNumber={job.workNumber} kind="FINISHED" taskId={t._id.toString()} label="Add finished photos" />
                  </span>
                )}
              </div>
              <PhotoGrid
                photos={grid(finished)}
                emptyText={t.status === "COMPLETED" ? "No photos were recorded." : "Photos of the finished work are added when the stage is completed."}
              />
            </div>
          );
        })}
    </section>
  );
}
