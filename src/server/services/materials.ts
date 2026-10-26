import "server-only";
import mongoose, { mongo } from "mongoose";
import { materialSchema, type MaterialInput } from "@/lib/schemas";
import { STANDARD_MATERIALS } from "@/lib/standard-materials";
import { connectDb } from "@/server/db/connect";
import { Material } from "@/server/db/models/Material";
import { audit } from "@/server/services/audit";
import { ServiceError, type Actor } from "@/server/services/users";

/** Only Super Admins edit the catalogue (proposal in the Phase 0 matrix). */
function assertCanEdit(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN") {
    throw new ServiceError("FORBIDDEN", "Only a Super Admin can change the material catalogue.");
  }
}

export async function listMaterials({ includeInactive = false } = {}) {
  await connectDb();
  return Material.find(includeInactive ? {} : { active: true })
    .sort({ category: 1, name: 1, thicknessMm: 1 })
    .lean();
}

export async function createMaterial(actor: Actor, input: MaterialInput) {
  assertCanEdit(actor);
  const data = materialSchema.parse(input);
  await connectDb();
  try {
    const material = await Material.create({ ...data, supplier: data.supplier || undefined });
    await audit({ actorId: actor.id, action: "material.created", targetType: "Material", targetId: material._id });
    return material;
  } catch (error) {
    if (error instanceof mongo.MongoServerError && error.code === 11000) {
      throw new ServiceError("DUPLICATE", "That material already exists at this thickness.");
    }
    throw error;
  }
}

/** Materials are retired, not deleted, so old jobs keep their specification. */
export async function setMaterialActive(actor: Actor, materialId: string, active: boolean) {
  assertCanEdit(actor);
  if (!mongoose.isValidObjectId(materialId)) throw new ServiceError("NOT_FOUND", "Material not found.");
  await connectDb();
  const material = await Material.findByIdAndUpdate(materialId, { active }, { returnDocument: "after" });
  if (!material) throw new ServiceError("NOT_FOUND", "Material not found.");
  await audit({
    actorId: actor.id,
    action: active ? "material.activated" : "material.retired",
    targetType: "Material",
    targetId: material._id,
  });
  return material;
}

/**
 * Adds any standard materials not already in the catalogue (matched on name
 * and thickness). Existing and retired entries are left alone.
 */
export async function addStandardMaterials(actorId?: string) {
  await connectDb();
  const existing = await Material.find().select("name thicknessMm").lean();
  const have = new Set(existing.map((m) => `${m.name}|${m.thicknessMm}`));
  const missing = STANDARD_MATERIALS.filter((m) => !have.has(`${m.name}|${m.thicknessMm}`));
  if (missing.length) await Material.insertMany(missing, { ordered: false });
  await audit({ actorId, action: "material.standard_added", meta: { added: missing.length } });
  return missing.length;
}
