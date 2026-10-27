import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { normalizeEmail } from "@/lib/identity";
import { connectDb } from "@/server/db/connect";
import { PasswordResetToken } from "@/server/db/models/PasswordResetToken";
import { User } from "@/server/db/models/User";
import { hashPassword } from "@/server/auth/password";
import { hit } from "@/server/auth/throttle";
import { sendEmail } from "@/server/email/resend";
import { audit } from "@/server/services/audit";
import { ServiceError } from "@/server/services/users";

const TTL_MS = 30 * 60 * 1000;
/** Reset emails per address per 15-minute window. */
const MAX_REQUESTS = 3;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function appUrl() {
  return (process.env.AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Starts a reset by email. Always resolves the same way, whether or not an
 * account exists, so the form cannot be used to discover who has one.
 */
export async function requestPasswordReset(emailInput: string, ip: string) {
  const email = normalizeEmail(emailInput);
  if (!email) throw new ServiceError("INVALID", "Enter a valid email address.");
  await connectDb();

  if ((await hit(`reset:ip:${ip}`)) > 20 || (await hit(`reset:email:${email}`)) > MAX_REQUESTS) return;

  const user = await User.findOne({ email, status: "ACTIVE" }).select("_id name").lean();
  if (!user) return;

  // One live link at a time: earlier unused links stop working.
  await PasswordResetToken.deleteMany({ userId: user._id, usedAt: null });
  const token = randomBytes(32).toString("base64url");
  await PasswordResetToken.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TTL_MS) });

  const link = `${appUrl()}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Reset your Pacwoods password",
    text: `Hello ${user.name},\n\nUse this link to choose a new Pacwoods password. It works once and expires in 30 minutes:\n\n${link}\n\nIf you did not ask for this, you can ignore this email; your password has not changed.\n\nPacwoods`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;color:#1b2328">
  <div style="background:#1b2328;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;font-weight:800">Pa<span style="color:#d99e56">C</span> WOODS</div>
  <div style="border:1px solid #e5e7e9;border-top:0;padding:20px;border-radius:0 0 8px 8px">
    <p>Hello ${escapeHtml(user.name)},</p>
    <p>Use the button below to choose a new password. It works once and expires in 30 minutes.</p>
    <p style="margin:24px 0"><a href="${link}" style="background:#d99e56;color:#1b2328;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">Choose a new password</a></p>
    <p style="font-size:13px;color:#5b6670">If you did not ask for this, ignore this email; your password has not changed.</p>
  </div>
</div>`,
  });
  await audit({ actorId: user._id, action: "user.password_reset_requested", targetType: "User", targetId: user._id, ip });
}

/** Whether a reset link is still usable (for showing the form or an error). */
export async function resetTokenIsValid(token: string) {
  if (!token || token.length > 100) return false;
  await connectDb();
  return Boolean(await PasswordResetToken.exists({ tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } }));
}

/**
 * Completes a reset: the token is claimed atomically (so it works once), the
 * password replaced, and every session signed out.
 */
export async function completePasswordReset(token: string, newPassword: string) {
  await connectDb();
  const claimed = await PasswordResetToken.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  ).lean();
  if (!claimed) throw new ServiceError("INVALID", "This link has expired or was already used. Ask for a new one.");

  const user = await User.findById(claimed.userId).select("+passwordHash");
  if (!user || user.status !== "ACTIVE") throw new ServiceError("INVALID", "This account is not active.");
  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.sessionVersion += 1;
  await user.save();
  await audit({ actorId: user._id, action: "user.password_reset_completed", targetType: "User", targetId: user._id });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
