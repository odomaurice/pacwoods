import "server-only";
import { createHash } from "node:crypto";
import mongoose, { type Types } from "mongoose";
import { DEFAULT_OPTIONS, cutlistSchema, toEngine, type CutlistInput } from "@/lib/cutlist";
import { optimise } from "@/lib/cutting/engine";
import { validatePlan } from "@/lib/cutting/validate";
import { connectDb } from "@/server/db/connect";
import { CutlistVersion, type CutlistVersionDoc, type StoredPart, type StoredStock } from "@/server/db/models/CutlistVersion";
import { Job } from "@/server/db/models/Job";
import { Material } from "@/server/db/models/Material";
import { audit } from "@/server/services/audit";
import { ServiceError, type Actor } from "@/server/services/users";
import { leaveCuttingQueue, queueForCutting, recordJobEvent, transitionJob } from "@/server/workflow/transitions";

function assertStaff(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
    throw new ServiceError("FORBIDDEN", "Only staff can edit cutlists.");
  }
}

/** Hash of everything that affects the layout (not display-only options). */
export function inputHash(input: CutlistInput) {
  const { labelsOnPanels: _display, ...options } = input.options;
  void _display;
  const canonical = JSON.stringify({
    parts: input.parts.map(({ ref, length, width, quantity, materialId, grain, edges }) => [ref, length, width, quantity, materialId ?? "", grain, edges.length1, edges.length2, edges.width1, edges.width2]),
    stock: input.stockSheets.map(({ ref, length, width, quantity, materialId, grained }) => [ref, length, width, quantity, materialId ?? "", grained]),
    options,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

async function loadJob(workNumber: string) {
  await connectDb();
  const job = await Job.findOne({ workNumber });
  if (!job) throw new ServiceError("NOT_FOUND", "Job not found.");
  return job;
}

/**
 * Validates the input and attaches a snapshot of each row's material, read
 * from the catalogue (never trusted from the browser).
 */
async function normalise(raw: unknown) {
  const parsed = cutlistSchema.safeParse(raw);
  if (!parsed.success) throw new ServiceError("INVALID", parsed.error.issues[0]?.message ?? "Check the cutlist.");
  const input = parsed.data;

  const ids = [...new Set([...input.parts, ...input.stockSheets].map((r) => r.materialId).filter(Boolean))] as string[];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new ServiceError("INVALID", "Unknown material.");
  const materials = await Material.find({ _id: { $in: ids } }).lean();
  const byId = new Map(materials.map((m) => [m._id.toString(), m]));
  if (byId.size !== ids.length) throw new ServiceError("INVALID", "A chosen material no longer exists.");

  const snap = <T extends { materialId?: string }>(row: T) => {
    const m = row.materialId ? byId.get(row.materialId) : undefined;
    return m ? { ...row, materialName: m.name, thicknessMm: m.thicknessMm } : { ...row, materialId: undefined };
  };
  return {
    input,
    parts: input.parts.map(snap) as StoredPart[],
    stockSheets: input.stockSheets.map(snap) as StoredStock[],
  };
}

export async function getCutlists(jobId: Types.ObjectId) {
  const versions = await CutlistVersion.find({ jobId }).sort({ version: -1 }).lean();
  return {
    draft: versions.find((v) => v.state === "DRAFT") ?? null,
    approved: versions.find((v) => v.state === "APPROVED") ?? null,
    versions,
  };
}

export function emptyCutlist(): CutlistInput {
  return { parts: [], stockSheets: [], options: DEFAULT_OPTIONS };
}

/** True when the stored plan was generated from exactly these inputs. */
export function planIsCurrent(v: Pick<CutlistVersionDoc, "parts" | "stockSheets" | "options" | "plan" | "planInputHash">) {
  return Boolean(v.plan && v.planInputHash && v.planInputHash === inputHash(v as unknown as CutlistInput));
}

async function upsertDraft(actor: Actor, workNumber: string, raw: unknown) {
  assertStaff(actor);
  const job = await loadJob(workNumber);
  if (job.status !== "DRAFT") {
    throw new ServiceError("CONFLICT", "This cutlist is approved. Reopen it for changes first.");
  }
  const { input, parts, stockSheets } = await normalise(raw);

  let draft = await CutlistVersion.findOne({ jobId: job._id, state: "DRAFT" });
  if (!draft) {
    const latest = await CutlistVersion.findOne({ jobId: job._id }).sort({ version: -1 }).select("version").lean();
    draft = new CutlistVersion({ jobId: job._id, version: (latest?.version ?? 0) + 1, updatedBy: actor.id });
  }
  draft.parts = parts;
  draft.stockSheets = stockSheets;
  draft.options = input.options;
  draft.updatedBy = new mongoose.Types.ObjectId(actor.id);
  return { job, draft, input };
}

export async function saveCutlistDraft(actor: Actor, workNumber: string, raw: unknown) {
  const { draft } = await upsertDraft(actor, workNumber, raw);
  await draft.save();
  return draft;
}

/** Saves the draft and runs the optimiser on the server. */
export async function generatePlan(actor: Actor, workNumber: string, raw: unknown) {
  const { job, draft, input } = await upsertDraft(actor, workNumber, raw);
  const engine = toEngine(input);
  const plan = optimise(engine.parts, engine.stocks, engine.options);
  const errors = validatePlan(plan, engine.parts, engine.stocks, engine.options);
  if (errors.length) {
    // An engine defect, never a user error: refuse to save a bad plan.
    console.error("Cutting plan failed validation", { workNumber, errors });
    throw new ServiceError("CONFLICT", "The optimiser produced an invalid layout. It was not saved; please report this.");
  }
  draft.plan = plan;
  draft.planInputHash = inputHash(input);
  draft.planGeneratedAt = new Date();
  await draft.save();
  await recordJobEvent(job._id, {
    type: "PLAN_GENERATED",
    actorId: actor.id,
    note: `${plan.totals.sheetsUsed} sheet(s), ${plan.totals.partsPlaced}/${plan.totals.partsRequested} panels placed`,
    clientVisible: false,
  });
  return draft;
}

/**
 * Locks the draft as the approved cutlist. The job moves on to waiting for
 * material, or straight into the cutting queue if materials are confirmed.
 * Requires a current plan that places every panel.
 */
export async function approveCutlist(actor: Actor, workNumber: string) {
  assertStaff(actor);
  const job = await loadJob(workNumber);
  if (job.status !== "DRAFT") throw new ServiceError("CONFLICT", "Only draft jobs can be approved.");
  const draft = await CutlistVersion.findOne({ jobId: job._id, state: "DRAFT" });
  if (!draft || draft.parts.length === 0) throw new ServiceError("CONFLICT", "Add panels and stock sheets first.");
  if (!draft.plan || !planIsCurrent(draft)) throw new ServiceError("CONFLICT", "Generate the cutting plan again: the cutlist changed since the last one.");
  if (draft.plan.unplaced.length > 0) throw new ServiceError("CONFLICT", "Some panels could not be placed. Fix them before approving.");

  await mongoose.connection.transaction(async (session) => {
    await CutlistVersion.updateMany({ jobId: job._id, state: "APPROVED" }, { $set: { state: "SUPERSEDED" } }, { session });
    const locked = await CutlistVersion.updateOne(
      { _id: draft._id, state: "DRAFT", planInputHash: draft.planInputHash },
      { $set: { state: "APPROVED", approvedBy: actor.id, approvedAt: new Date() } },
      { session },
    );
    if (locked.modifiedCount !== 1) throw new ServiceError("CONFLICT", "The cutlist changed while approving. Reload and try again.");
    const event = { type: "CUTLIST_APPROVED", actorId: actor.id, note: `Cutlist version ${draft.version} approved` };
    // Materials already confirmed: straight into the cutting queue.
    if (job.materialConfirmedAt) await queueForCutting(job, "DRAFT", event, session);
    else await transitionJob(job._id, "DRAFT", "AWAITING_MATERIAL", event, session);
  });
  await audit({ actorId: actor.id, action: "cutlist.approved", targetType: "Job", targetId: job._id, meta: { version: draft.version } });
}

/**
 * Reopens an approved cutlist before production starts: a new draft version
 * is created from the approved one, which stays intact until replaced.
 */
export async function reopenCutlist(actor: Actor, workNumber: string, reason: string) {
  assertStaff(actor);
  const why = reason.trim();
  if (why.length < 3) throw new ServiceError("INVALID", "Give a reason for the change.");
  const job = await loadJob(workNumber);
  if (job.status !== "AWAITING_MATERIAL" && job.status !== "QUEUED_FOR_CUTTING") {
    throw new ServiceError("CONFLICT", "Only approved jobs that have not started production can be reopened.");
  }
  const from = job.status;
  const approved = await CutlistVersion.findOne({ jobId: job._id, state: "APPROVED" }).lean();
  if (!approved) throw new ServiceError("CONFLICT", "There is no approved cutlist to revise.");

  await mongoose.connection.transaction(async (session) => {
    await CutlistVersion.create(
      [
        {
          jobId: job._id,
          version: approved.version + 1,
          state: "DRAFT",
          parts: approved.parts,
          stockSheets: approved.stockSheets,
          options: approved.options,
          plan: approved.plan,
          planInputHash: approved.planInputHash,
          planGeneratedAt: approved.planGeneratedAt,
          revisionReason: why.slice(0, 500),
          updatedBy: actor.id,
        },
      ],
      { session },
    );
    if (from === "QUEUED_FOR_CUTTING") await leaveCuttingQueue(job._id, session);
    await transitionJob(job._id, from, "DRAFT", {
      type: "CUTLIST_REOPENED",
      actorId: actor.id,
      reason: why.slice(0, 500),
    }, session);
  });
  await audit({ actorId: actor.id, action: "cutlist.reopened", targetType: "Job", targetId: job._id, meta: { reason: why } });
}

/**
 * A job with its cutlist versions. `current` is what the job is working
 * from: the draft while the job is a draft, otherwise the approved version.
 */
export async function loadJobCutlist(workNumber: string) {
  await connectDb();
  const job = await Job.findOne({ workNumber }).lean();
  if (!job) return null;
  const { draft, approved, versions } = await getCutlists(job._id);
  const current = job.status === "DRAFT" ? (draft ?? approved) : (approved ?? draft);
  return { job, draft, approved, versions, current };
}
