import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordResetToken } from "@/server/db/models/PasswordResetToken";
import { User } from "@/server/db/models/User";
import { verifyPassword } from "@/server/auth/password";
import { completePasswordReset, requestPasswordReset, resetTokenIsValid } from "@/server/services/passwordReset";
import { bootstrapSuperAdmin, provisionClient } from "@/server/services/users";
import { connectTestDb, disconnectTestDb, hasDatabase } from "./setup";

const sent = vi.hoisted(() => [] as { to: string; text: string }[]);
vi.mock("@/server/email/resend", () => ({
  emailConfigured: () => true,
  sendEmail: async (m: { to: string; text: string }) => {
    sent.push(m);
    return { sent: true };
  },
}));

const tokenFrom = (text: string) => /token=([\w-]+)/.exec(text)![1];

describe.skipIf(!hasDatabase)("password reset by email (MongoDB)", () => {
  let userId: string;

  beforeAll(async () => {
    await connectTestDb();
    const { user } = await bootstrapSuperAdmin({ name: "Root", email: "root@example.com" });
    const admin = { id: user._id.toString(), role: "SUPER_ADMIN" as const, permissions: [] };
    const client = await provisionClient(admin, { name: "Kemi", email: "kemi@example.com" });
    userId = client.user._id.toString();
  });
  afterAll(disconnectTestDb);
  beforeEach(() => {
    sent.length = 0;
  });

  it("sends nothing for an unknown address, without saying so", async () => {
    await expect(requestPasswordReset("nobody@example.com", "1.1.1.1")).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it("stores only a hash, works once, and signs every session out", async () => {
    await requestPasswordReset("Kemi@Example.com", "1.1.1.2");
    expect(sent).toHaveLength(1);
    const token = tokenFrom(sent[0].text);
    expect(await PasswordResetToken.exists({ tokenHash: token })).toBeNull();
    expect(await resetTokenIsValid(token)).toBe(true);

    const before = await User.findById(userId).lean();
    await completePasswordReset(token, "a brand new password");
    const after = await User.findById(userId).select("+passwordHash").lean();
    expect(await verifyPassword(after!.passwordHash, "a brand new password")).toBe(true);
    expect(after!.sessionVersion).toBe(before!.sessionVersion + 1);
    expect(after!.mustChangePassword).toBe(false);

    expect(await resetTokenIsValid(token)).toBe(false);
    await expect(completePasswordReset(token, "another password here")).rejects.toMatchObject({ code: "INVALID" });
  });

  it("keeps only the newest link and refuses expired ones", async () => {
    await requestPasswordReset("kemi@example.com", "1.1.1.3");
    await requestPasswordReset("kemi@example.com", "1.1.1.3");
    const [first, second] = sent.map((m) => tokenFrom(m.text));
    expect(await resetTokenIsValid(first)).toBe(false);
    expect(await resetTokenIsValid(second)).toBe(true);

    await PasswordResetToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(completePasswordReset(second, "a brand new password")).rejects.toMatchObject({ code: "INVALID" });
  });

  it("limits how many emails one address can trigger", async () => {
    for (let i = 0; i < 6; i++) await requestPasswordReset("kemi@example.com", `2.2.2.${i}`);
    // Two were already used by the previous test in this 15-minute window.
    expect(sent.length).toBeLessThanOrEqual(1);
  });
});
