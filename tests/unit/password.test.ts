import { describe, expect, it } from "vitest";
import { changePasswordSchema } from "@/lib/password-policy";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "@/server/auth/password";

describe("password hashing", () => {
  it("uses Argon2id and verifies only the right password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).toContain("m=19456,t=2,p=1");
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("treats a malformed hash as a failed match, not a crash", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });
});

describe("generateTemporaryPassword", () => {
  it("avoids look-alike characters and does not repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const pw = generateTemporaryPassword();
      expect(pw).toMatch(/^[A-HJ-NP-Za-km-z2-9]{14}$/);
      seen.add(pw);
    }
    expect(seen.size).toBe(500);
  });
});

describe("changePasswordSchema", () => {
  const base = { currentPassword: "Temp123456789", newPassword: "a-new-password", confirmPassword: "a-new-password" };

  it("accepts a valid change", () => {
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
  });

  it("rejects short, mismatched or unchanged passwords", () => {
    expect(changePasswordSchema.safeParse({ ...base, newPassword: "short", confirmPassword: "short" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ ...base, confirmPassword: "different-one" }).success).toBe(false);
    expect(
      changePasswordSchema.safeParse({ ...base, newPassword: base.currentPassword, confirmPassword: base.currentPassword }).success,
    ).toBe(false);
  });
});
