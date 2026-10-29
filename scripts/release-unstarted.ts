/**
 * Operators now take work themselves by starting it. Stages that an admin
 * assigned under the old rules but nobody has started yet still carry that
 * operator, which hides them from everyone else: this hands them back to the
 * shared queue. Work that has been started (including paused) keeps its
 * operator. Safe to run repeatedly. Dry run by default:
 *
 *   npm run repair:unstarted            # report only
 *   npm run repair:unstarted -- --apply # fix
 */
import mongoose, { type QueryFilter } from "mongoose";
import { connectDb } from "../src/server/db/connect";
import { ProductionTask, type ProductionTaskDoc } from "../src/server/db/models/ProductionTask";

const apply = process.argv.includes("--apply");

async function main() {
  await connectDb();
  const filter: QueryFilter<ProductionTaskDoc> = { status: { $in: ["BLOCKED", "QUEUED"] }, firstStartedAt: null, assignedOperatorId: { $ne: null } };
  const tasks = await ProductionTask.find(filter).select("workNumber stage status").lean();
  for (const t of tasks) console.log(`${t.workNumber} ${t.stage.toLowerCase()} (${t.status.toLowerCase()}): ${apply ? "released" : "would be released"}`);
  if (apply && tasks.length) {
    const r = await ProductionTask.updateMany({ _id: { $in: tasks.map((t) => t._id) }, ...filter }, { $unset: { assignedOperatorId: 1 } });
    console.log(`Released ${r.modifiedCount} stage(s).`);
  } else {
    console.log(tasks.length ? `${tasks.length} stage(s) to release. Run again with --apply.` : "Nothing to release.");
  }
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
