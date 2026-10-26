import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { User } from "@/server/db/models/User";
import { createJob, updateDraftJob } from "@/server/services/jobs";
import { createMaterial } from "@/server/services/materials";
import {
  bootstrapSuperAdmin,
  provisionAccount,
  provisionClient,
  resetPassword,
  setUserStatus,
  type Actor,
} from "@/server/services/users";
import { connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("clients, jobs and account management (MongoDB)", () => {
  let root: Actor;
  let admin: Actor;

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@p2.test" });
    root = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
    const a = await provisionAccount(root, { role: "ADMIN", name: "Admin", email: "admin@p2.test" });
    admin = { id: a.user._id.toString(), role: "ADMIN", permissions: [] };
  });
  afterAll(disconnectTestDb);

  it("gives concurrent clients unique, consecutive client numbers", async () => {
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, i) => provisionClient(admin, { name: `C${i}`, phone: `+23480100000${10 + i}` })),
    );
    const numbers = created.map((c) => c.profile.clientNumber).sort();
    expect(new Set(numbers).size).toBe(8);
    expect(numbers[0]).toBe("PCL-000001");
    expect(numbers[7]).toBe("PCL-000008");
  });

  it("rolls back the account if the client cannot be created", async () => {
    const before = await User.countDocuments({ role: "CLIENT" });
    await expect(provisionClient(admin, { name: "Dup", phone: "+2348010000010" })).rejects.toMatchObject({
      code: "DUPLICATE",
    });
    expect(await User.countDocuments({ role: "CLIENT" })).toBe(before);
  });

  it("assigns unique work numbers under concurrency", async () => {
    const { profile } = await provisionClient(admin, { name: "Jobs", phone: "+2348020000001" });
    const now = new Date("2026-10-26T12:00:00Z");
    const jobs = await Promise.all(
      Array.from({ length: 10 }, () =>
        createJob(admin, { clientId: profile._id.toString(), cutting: true, edging: true }, now),
      ),
    );
    const numbers = jobs.map((j) => j.workNumber).sort();
    expect(new Set(numbers).size).toBe(10);
    expect(numbers[0]).toBe("PAC-2026-000001");
    expect(jobs.every((j) => j.status === "DRAFT")).toBe(true);
  });

  it("refuses edging-only jobs and jobs for suspended clients", async () => {
    const { user, profile } = await provisionClient(admin, { name: "Sus", phone: "+2348020000002" });
    await expect(
      createJob(admin, { clientId: profile._id.toString(), cutting: false, edging: true }),
    ).rejects.toThrow();
    await setUserStatus(admin, user._id.toString(), "SUSPENDED");
    await expect(
      createJob(admin, { clientId: profile._id.toString(), cutting: true, edging: false }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("only lets drafts be edited", async () => {
    const { profile } = await provisionClient(admin, { name: "Ed", phone: "+2348020000003" });
    const job = await createJob(admin, { clientId: profile._id.toString(), cutting: true, edging: false });
    const updated = await updateDraftJob(admin, job.workNumber, { cutting: true, edging: true, title: "Wardrobe" });
    expect(updated.operations?.edging).toBe(true);
    job.status = "AWAITING_APPROVAL";
    await job.save();
    await expect(updateDraftJob(admin, job.workNumber, { cutting: true, edging: false })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("suspending signs the user out and blocks password resets", async () => {
    const { user } = await provisionClient(admin, { name: "Sx", phone: "+2348020000004" });
    const suspended = await setUserStatus(admin, user._id.toString(), "SUSPENDED", "test");
    expect(suspended.status).toBe("SUSPENDED");
    expect(suspended.sessionVersion).toBe(user.sessionVersion + 1);
    await expect(resetPassword(admin, user._id.toString())).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("stops Admins managing Admins, and anyone managing themselves", async () => {
    const other = await provisionAccount(root, { role: "ADMIN", name: "Other", email: "other@p2.test" });
    await expect(setUserStatus(admin, other.user._id.toString(), "SUSPENDED")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(setUserStatus(root, root.id, "SUSPENDED")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(resetPassword(root, other.user._id.toString())).resolves.toHaveProperty("temporaryPassword");
  });

  it("lets only a Super Admin add materials", async () => {
    const input = {
      name: "MDF",
      category: "MDF",
      thicknessMm: 18,
      grain: "NONE" as const,
      sheetLengthMm: 2440,
      sheetWidthMm: 1220,
    };
    await expect(createMaterial(admin, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createMaterial(root, input)).resolves.toHaveProperty("name", "MDF");
    await expect(createMaterial(root, input)).rejects.toMatchObject({ code: "DUPLICATE" });
  });
});
