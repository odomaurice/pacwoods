import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nextSequence } from "@/server/db/models/Counter";
import { User } from "@/server/db/models/User";
import { hit, peek } from "@/server/auth/throttle";
import { verifyPassword } from "@/server/auth/password";
import {
  ServiceError,
  bootstrapSuperAdmin,
  changePassword,
  provisionAccount,
  provisionClient,
} from "@/server/services/users";
import { connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

describe.skipIf(!hasDatabase)("accounts (MongoDB)", () => {
  let superAdmin: { id: string; role: "SUPER_ADMIN"; permissions: string[] };

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@example.com" });
    superAdmin = { id: user._id.toString(), role: "SUPER_ADMIN", permissions: [] };
  });
  afterAll(disconnectTestDb);

  it("refuses a second bootstrap Super Admin", async () => {
    await expect(bootstrapSuperAdmin({ name: "Two", email: "two@example.com" })).rejects.toThrow(
      "already exists",
    );
  });

  it("stores only an Argon2id hash of the temporary password and forces a change", async () => {
    const { user, temporaryPassword } = await provisionAccount(superAdmin, {
      role: "ADMIN",
      name: "Ada Admin",
      email: "ada@example.com",
    });
    const stored = await User.findById(user._id).select("+passwordHash").lean();
    expect(stored!.passwordHash).not.toContain(temporaryPassword);
    expect(stored!.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(stored!.passwordHash, temporaryPassword)).toBe(true);
    expect(stored!.mustChangePassword).toBe(true);
  });

  it("allows many phone-only clients but no duplicate phone numbers", async () => {
    const a = await provisionClient(superAdmin, { name: "A", phone: "+2348000000001" });
    const b = await provisionClient(superAdmin, { name: "B", phone: "+2348000000002" });
    expect(a.user.email).toBeUndefined();
    expect(b.user.email).toBeUndefined();
    await expect(
      provisionClient(superAdmin, { name: "C", phone: "+234 800 000 0001" }),
    ).rejects.toMatchObject({ code: "DUPLICATE" });
  });

  it("rejects accounts with no phone and no email", async () => {
    await expect(provisionClient(superAdmin, { name: "Nobody" })).rejects.toBeInstanceOf(
      ServiceError,
    );
  });

  it("stops an Admin without the permission from creating operators or admins", async () => {
    const admin = { id: superAdmin.id, role: "ADMIN" as const, permissions: [] };
    await expect(
      provisionAccount(admin, { role: "OPERATOR", name: "Op", email: "op@example.com" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      provisionAccount(admin, { role: "ADMIN", name: "Ad", email: "ad@example.com" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("changing the password clears the flag and revokes sessions", async () => {
    const { user, temporaryPassword } = await provisionClient(superAdmin, {
      name: "Client",
      email: "client@example.com",
    });
    await expect(changePassword(user._id.toString(), "wrong-password", "new-password-1")).rejects.toMatchObject({
      code: "INVALID",
    });
    await changePassword(user._id.toString(), temporaryPassword, "new-password-1");
    const after = await User.findById(user._id).lean();
    expect(after!.mustChangePassword).toBe(false);
    expect(after!.sessionVersion).toBe(user.sessionVersion + 1);
  });

  it("counts throttle hits atomically under concurrency", async () => {
    await Promise.all(Array.from({ length: 25 }, () => hit("test:key")));
    expect(await peek("test:key")).toBe(25);
  });

  it("hands out unique sequence numbers under concurrency", async () => {
    const values = await Promise.all(Array.from({ length: 50 }, () => nextSequence("test:seq")));
    expect(new Set(values).size).toBe(50);
    expect(Math.max(...values)).toBe(50);
  });
});
