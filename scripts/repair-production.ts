/**
 * Repairs jobs written while a dev server ran with stale model definitions
 * (fields silently dropped), and jobs created before production stages
 * existed. Safe to run repeatedly. Dry run by default:
 *
 *   npm run repair:production            # report only
 *   npm run repair:production -- --apply # fix
 */
import mongoose from "mongoose";
import { connectDb } from "../src/server/db/connect";
import { nextSequence } from "../src/server/db/models/Counter";
import { Job } from "../src/server/db/models/Job";
import { JobStatusEvent } from "../src/server/db/models/JobStatusEvent";
import { ProductionTask } from "../src/server/db/models/ProductionTask";

const apply = process.argv.includes("--apply");

async function main() {
  await connectDb();
  const jobs = await Job.find({ status: { $nin: ["COMPLETED", "CANCELLED"] } }).lean();
  let changes = 0;

  for (const job of jobs) {
    const fixes: string[] = [];
    const set: Record<string, unknown> = {};

    // 1. Materials: trust the latest confirm/withdraw event on the timeline.
    const last = await JobStatusEvent.findOne({ jobId: job._id, type: { $in: ["MATERIAL_CONFIRMED", "MATERIAL_WITHDRAWN"] } })
      .sort({ at: -1 })
      .lean();
    if (last?.type === "MATERIAL_CONFIRMED" && !job.materialConfirmedAt) {
      set.materialConfirmedAt = last.at;
      set.materialConfirmedBy = last.actorId;
      fixes.push("restore materials confirmation from the timeline");
    }

    // 2. Queue ticket for jobs already in the cutting queue.
    let seq = job.cuttingQueueSeq ?? undefined;
    if (job.status === "QUEUED_FOR_CUTTING" && seq == null) {
      fixes.push("issue a cutting queue ticket");
      if (apply) set.cuttingQueueSeq = seq = await nextSequence("queue:cutting");
    }

    // 3. Production stages.
    const tasks = await ProductionTask.find({ jobId: job._id }).lean();
    const needCutting = !tasks.some((t) => t.stage === "CUTTING");
    const needEdging = Boolean(job.operations?.edging) && !tasks.some((t) => t.stage === "EDGING");
    if (needCutting) fixes.push(`create the cutting stage (${job.status === "QUEUED_FOR_CUTTING" ? "queued" : "waiting"})`);
    if (needEdging) fixes.push("create the edging stage (waiting)");

    if (fixes.length === 0) continue;
    changes++;
    console.log(`${job.workNumber} (${job.status}): ${fixes.join("; ")}`);
    if (!apply) continue;

    if (Object.keys(set).length) await Job.updateOne({ _id: job._id }, { $set: set });
    if (needCutting) {
      const queued = job.status === "QUEUED_FOR_CUTTING";
      await ProductionTask.create({
        jobId: job._id,
        workNumber: job.workNumber,
        stage: "CUTTING",
        status: queued ? "QUEUED" : "BLOCKED",
        ...(queued ? { queueSeq: seq, queuedAt: new Date() } : {}),
      });
    }
    if (needEdging) await ProductionTask.create({ jobId: job._id, workNumber: job.workNumber, stage: "EDGING", status: "BLOCKED" });
  }

  console.log(changes === 0 ? "Nothing to repair." : apply ? `Repaired ${changes} job(s).` : `${changes} job(s) need repair. Run again with --apply.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
