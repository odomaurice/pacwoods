import "server-only";
import { mongo } from "mongoose";
import { normalizeEmail, normalizePhone } from "@/lib/identity";
import { canProvision, type Capability, type Permission, type Role } from "@/lib/roles";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "@/server/auth/password";
import { connectDb } from "@/server/db/connect";
import { User } from "@/server/db/models/User";
import { audit } from "@/server/services/audit";

export class ServiceError extends Error {
  constructor(
    public code: "FORBIDDEN" | "INVALID" | "DUPLICATE" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export type NewAccount = {
  role: Role;
  name: string;
  phone?: string;
  email?: string;
  permissions?: Permission[];
  capabilities?: Capability[];
};

type Actor = { id: string; role: Role; permissions: readonly string[] };

/**
 * Creates an account with a fresh temporary password and returns it. This is
 * the only time the plaintext exists; it is never stored or shown again.
 */
async function createAccount(input: NewAccount, createdBy?: string) {
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : undefined;
  const email = input.email?.trim() ? normalizeEmail(input.email) : undefined;
  if (phone === null) throw new ServiceError("INVALID", "That phone number is not valid.");
  if (email === null) throw new ServiceError("INVALID", "That email address is not valid.");
  if (!phone && !email) {
    throw new ServiceError("INVALID", "A phone number or an email address is required.");
  }

  const temporaryPassword = generateTemporaryPassword();
  try {
    const user = await User.create({
      role: input.role,
      name: input.name.trim(),
      phone,
      email,
      permissions: input.role === "ADMIN" ? (input.permissions ?? []) : [],
      capabilities: input.role === "OPERATOR" ? (input.capabilities ?? []) : [],
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      createdBy,
    });
    return { user, temporaryPassword };
  } catch (error) {
    if (error instanceof mongo.MongoServerError && error.code === 11000) {
      throw new ServiceError("DUPLICATE", "That phone number or email is already registered.");
    }
    throw error;
  }
}

/** Account creation from inside the app; enforces who may create whom. */
export async function provisionAccount(actor: Actor, input: NewAccount) {
  if (!canProvision(actor, input.role)) {
    throw new ServiceError("FORBIDDEN", "You cannot create this kind of account.");
  }
  await connectDb();
  const result = await createAccount(input, actor.id);
  await audit({
    actorId: actor.id,
    action: "user.created",
    targetType: "User",
    targetId: result.user._id,
    meta: { role: input.role },
  });
  return result;
}

/** The first Super Admin, from the command line only. */
export async function bootstrapSuperAdmin(input: Omit<NewAccount, "role">) {
  await connectDb();
  if (await User.exists({ role: "SUPER_ADMIN" })) {
    throw new ServiceError("FORBIDDEN", "A Super Admin already exists.");
  }
  const result = await createAccount({ ...input, role: "SUPER_ADMIN" });
  await audit({
    action: "user.bootstrap_super_admin",
    targetType: "User",
    targetId: result.user._id,
  });
  return result;
}

/**
 * Sets a new password, clears the temporary-password flag and bumps the
 * session version, which signs the user out on every other device.
 */
export async function changePassword(userId: string, current: string, next: string) {
  await connectDb();
  const user = await User.findById(userId).select("+passwordHash");
  if (!user || user.status !== "ACTIVE") throw new ServiceError("NOT_FOUND", "Account not found.");
  if (!(await verifyPassword(user.passwordHash, current))) {
    throw new ServiceError("INVALID", "Your current password is not correct.");
  }

  user.passwordHash = await hashPassword(next);
  user.mustChangePassword = false;
  user.sessionVersion += 1;
  await user.save();
  await audit({ actorId: user._id, action: "user.password_changed", targetType: "User", targetId: user._id });

  return { identifier: user.phone ?? user.email! };
}
