import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { AuditLog } from "@/server/db/models/AuditLog";
import { emptyCutlist } from "@/server/services/cutlists";
import { getSettings, updateSettings } from "@/server/services/settings";
import { bootstrapSuperAdmin, provisionAccount, type Actor } from "@/server/services/users";
import { connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("workshop settings (MongoDB)", () => {
  let root: Actor;
  let admin: Actor;
  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@st.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    admin = { id: (await provisionAccount(root, { role: "ADMIN", name: "A", email: "a@st.test" })).user._id.toString(), role: "ADMIN", permissions: [] };
  });
  afterAll(disconnectTestDb);

  it("starts from defaults, and only a Super Admin can change it", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    await expect(updateSettings(admin, { ...DEFAULT_SETTINGS, kerf: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateSettings(root, { ...DEFAULT_SETTINGS, kerf: 99 })).rejects.toMatchObject({ code: "INVALID" });
  });

  it("saves, records what changed, and new cutlists use it", async () => {
    await updateSettings(root, { ...DEFAULT_SETTINGS, kerf: 3.2, edgeTrim: 10, timeZone: "Africa/Lagos" });
    const log = await AuditLog.findOne({ action: "settings.updated" }).sort({ at: -1 }).lean();
    expect((log?.meta as { changed: string }).changed).toBe("kerf: 4 → 3.2; edgeTrim: 0 → 10; timeZone: UTC → Africa/Lagos");
    // getSettings is cached per request; a fresh call outside React reads the new value.
    const fresh = await emptyCutlist();
    expect(fresh.options.kerf).toBe(3.2);
    expect(fresh.options.edgeTrim).toBe(10);
  });
});
