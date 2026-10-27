import "server-only";
import { cache } from "react";
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from "@/lib/settings";
import { connectDb } from "@/server/db/connect";
import { SystemSetting } from "@/server/db/models/SystemSetting";
import { audit } from "@/server/services/audit";
import { ServiceError, type Actor } from "@/server/services/users";

const KEY = "workshop";

/**
 * The workshop settings, read once per request. Anything missing or invalid
 * in the stored document falls back to the defaults, field by field.
 */
export const getSettings = cache(async (): Promise<Settings> => {
  try {
    await connectDb();
    const doc = await SystemSetting.findById(KEY).lean();
    const merged = { ...DEFAULT_SETTINGS, ...((doc?.value as Partial<Settings>) ?? {}) };
    const parsed = settingsSchema.safeParse(merged);
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export async function updateSettings(actor: Actor, input: Settings) {
  if (actor.role !== "SUPER_ADMIN") throw new ServiceError("FORBIDDEN", "Only a Super Admin can change settings.");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("INVALID", parsed.error.issues[0]?.message ?? "Check the settings.");
  await connectDb();
  const before = await SystemSetting.findById(KEY).lean();
  await SystemSetting.updateOne({ _id: KEY }, { $set: { value: parsed.data, updatedBy: actor.id } }, { upsert: true });
  // Readable summary for the audit log: only what changed.
  const old = { ...DEFAULT_SETTINGS, ...((before?.value as Partial<Settings>) ?? {}) };
  const changed = (Object.keys(parsed.data) as Array<keyof Settings>)
    .filter((k) => old[k] !== parsed.data[k])
    .map((k) => `${k}: ${old[k]} → ${parsed.data[k]}`)
    .join("; ");
  await audit({ actorId: actor.id, action: "settings.updated", meta: { changed: changed || "no changes" } });
  return parsed.data;
}
