import "server-only";
import mongoose, { mongo, type ClientSession, type Types } from "mongoose";
import { formatPhone, normalizeEmail, normalizePhone } from "@/lib/identity";
import { formatClientNumber } from "@/lib/numbers";
import { canProvision, type Capability, type Permission, type Role } from "@/lib/roles";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "@/server/auth/password";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { nextSequence } from "@/server/db/models/Counter";
import { User, type UserStatus } from "@/server/db/models/User";
import { audit } from "@/server/services/audit";

export class ServiceError extends Error {
  constructor(
    public code: "FORBIDDEN" | "INVALID" | "DUPLICATE" | "NOT_FOUND" | "CONFLICT",
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

export type NewClient = Omit<NewAccount, "role" | "permissions" | "capabilities"> & {
  businessName?: string;
  address?: string;
  staffNotes?: string;
};

export type Actor = { id: string; role: Role; permissions: readonly string[] };

function isDuplicateKey(error: unknown) {
  return error instanceof mongo.MongoServerError && error.code === 11000;
}

/**
 * Creates an account with a fresh temporary password and returns it. This is
 * the only time the plaintext exists; it is never stored or shown again.
 */
async function createAccount(input: NewAccount, createdBy?: string, session?: ClientSession) {
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : undefined;
  const email = input.email?.trim() ? normalizeEmail(input.email) : undefined;
  if (phone === null) throw new ServiceError("INVALID", "That phone number is not valid.");
  if (email === null) throw new ServiceError("INVALID", "That email address is not valid.");
  if (!phone && !email) {
    throw new ServiceError("INVALID", "A phone number or an email address is required.");
  }
  if (input.role === "OPERATOR" && !input.capabilities?.length) {
    throw new ServiceError("INVALID", "An operator needs at least one capability.");
  }

  const temporaryPassword = generateTemporaryPassword();
  try {
    const [user] = await User.create(
      [
        {
          role: input.role,
          name: input.name.trim(),
          phone,
          email,
          permissions: input.role === "ADMIN" ? (input.permissions ?? []) : [],
          capabilities: input.role === "OPERATOR" ? (input.capabilities ?? []) : [],
          passwordHash: await hashPassword(temporaryPassword),
          mustChangePassword: true,
          createdBy,
        },
      ],
      { session },
    );
    return { user, temporaryPassword };
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new ServiceError("DUPLICATE", "That phone number or email is already registered.");
    }
    throw error;
  }
}

/** Staff accounts (Admin, Operator). Clients go through provisionClient. */
export async function provisionAccount(actor: Actor, input: NewAccount) {
  if (input.role === "CLIENT") {
    throw new ServiceError("INVALID", "Create clients with their client details.");
  }
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

/** A client account and its profile, with the next client number, atomically. */
export async function provisionClient(actor: Actor, input: NewClient) {
  if (!canProvision(actor, "CLIENT")) {
    throw new ServiceError("FORBIDDEN", "You cannot create client accounts.");
  }
  await connectDb();

  const result = await mongoose.connection.transaction(async (session) => {
    const account = await createAccount({ ...input, role: "CLIENT" }, actor.id, session);
    const clientNumber = formatClientNumber(await nextSequence("client", session));
    const [profile] = await ClientProfile.create(
      [
        {
          userId: account.user._id,
          clientNumber,
          businessName: input.businessName?.trim() || undefined,
          address: input.address?.trim() || undefined,
          staffNotes: input.staffNotes?.trim() || undefined,
        },
      ],
      { session },
    );
    return { ...account, profile };
  });

  await audit({
    actorId: actor.id,
    action: "user.created",
    targetType: "User",
    targetId: result.user._id,
    meta: { role: "CLIENT", clientNumber: result.profile.clientNumber },
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

/** Loads a user the actor is allowed to manage, or throws. */
async function loadManagedUser(actor: Actor, userId: string) {
  if (!mongoose.isValidObjectId(userId)) throw new ServiceError("NOT_FOUND", "Account not found.");
  await connectDb();
  const user = await User.findById(userId);
  if (!user) throw new ServiceError("NOT_FOUND", "Account not found.");
  if (user._id.toString() === actor.id) {
    throw new ServiceError("FORBIDDEN", "You cannot do this to your own account.");
  }
  if (!canProvision(actor, user.role)) {
    throw new ServiceError("FORBIDDEN", "You cannot manage this account.");
  }
  return user;
}

const STATUS_ACTIONS: Record<UserStatus, string> = {
  ACTIVE: "user.reactivated",
  SUSPENDED: "user.suspended",
  DEACTIVATED: "user.deactivated",
};

/**
 * Suspending or deactivating signs the user out everywhere at once (the
 * session check rejects any non-active user). Records are never deleted.
 */
export async function setUserStatus(actor: Actor, userId: string, status: UserStatus, reason?: string) {
  const user = await loadManagedUser(actor, userId);
  if (user.status === status) return user;
  const previous = user.status;
  user.status = status;
  user.sessionVersion += 1;
  await user.save();
  await audit({
    actorId: actor.id,
    action: STATUS_ACTIONS[status],
    targetType: "User",
    targetId: user._id,
    meta: { from: previous, reason },
  });
  return user;
}

/** New temporary password, shown once; signs the user out everywhere. */
export async function resetPassword(actor: Actor, userId: string) {
  const user = await loadManagedUser(actor, userId);
  if (user.status !== "ACTIVE") {
    throw new ServiceError("CONFLICT", "Reactivate the account before resetting its password.");
  }
  const temporaryPassword = generateTemporaryPassword();
  user.passwordHash = await hashPassword(temporaryPassword);
  user.mustChangePassword = true;
  user.sessionVersion += 1;
  await user.save();
  await audit({ actorId: actor.id, action: "user.password_reset", targetType: "User", targetId: user._id });
  return { user, temporaryPassword };
}

export async function revokeSessions(actor: Actor, userId: string) {
  const user = await loadManagedUser(actor, userId);
  user.sessionVersion += 1;
  await user.save();
  await audit({ actorId: actor.id, action: "user.sessions_revoked", targetType: "User", targetId: user._id });
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

  return { identifier: formatPhone(user.phone) || user.email! };
}

export const PAGE_SIZE = 20;

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One page of accounts of the given roles, newest first, optionally searched. */
export async function listUsers(roles: Role[], { q = "", page = 1 } = {}) {
  await connectDb();
  const filter: Record<string, unknown> = { role: { $in: roles } };
  const term = q.trim();
  if (term) {
    const re = new RegExp(escapeRegex(term), "i");
    filter.$or = [{ name: re }, { email: re }, { phone: re }, { phone: normalizePhone(term) ?? "" }];
  }
  const [rows, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    User.countDocuments(filter),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Clients with their profile, searchable by name, contact or client number. */
export async function listClients({ q = "", page = 1 } = {}) {
  await connectDb();
  const term = q.trim();
  const re = term ? new RegExp(escapeRegex(term), "i") : null;
  const match = re
    ? { $or: [{ "user.name": re }, { "user.email": re }, { "user.phone": re }, { "user.phone": normalizePhone(term) ?? "" }, { clientNumber: re }, { businessName: re }] }
    : {};

  const [result] = await ClientProfile.aggregate<{
    rows: Array<{
      _id: Types.ObjectId;
      clientNumber: string;
      businessName?: string;
      user: { _id: Types.ObjectId; name: string; phone?: string; email?: string; status: UserStatus };
    }>;
    total: Array<{ n: number }>;
  }>([
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        rows: [{ $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }],
        total: [{ $count: "n" }],
      },
    },
  ]);
  const total = result?.total[0]?.n ?? 0;
  return { rows: result?.rows ?? [], total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getClient(clientId: string) {
  if (!mongoose.isValidObjectId(clientId)) return null;
  await connectDb();
  const profile = await ClientProfile.findById(clientId).lean();
  if (!profile) return null;
  const user = await User.findById(profile.userId).lean();
  return user ? { profile, user } : null;
}

/** Active clients for pickers, labelled "Business — Name (PCL-000001)". */
export async function listActiveClientOptions() {
  await connectDb();
  const rows = await ClientProfile.aggregate<{ _id: Types.ObjectId; clientNumber: string; businessName?: string; name: string }>([
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $match: { "user.status": "ACTIVE" } },
    { $project: { clientNumber: 1, businessName: 1, name: "$user.name" } },
    { $sort: { businessName: 1, name: 1 } },
  ]);
  return rows.map((r) => ({
    id: r._id.toString(),
    label: `${r.businessName ? `${r.businessName} — ` : ""}${r.name} (${r.clientNumber})`,
  }));
}
