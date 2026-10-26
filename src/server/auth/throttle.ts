import "server-only";
import { AuthThrottle } from "@/server/db/models/AuthThrottle";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** Failed attempts allowed per account per window before it is locked out. */
export const LOGIN_LIMIT_PER_ACCOUNT = 5;
/** Attempts allowed per IP per window, across all accounts. */
export const LOGIN_LIMIT_PER_IP = 30;

function windowKey(key: string, now: number) {
  const window = Math.floor(now / LOGIN_WINDOW_MS);
  return { id: `${key}:${window}`, expiresAt: new Date((window + 1) * LOGIN_WINDOW_MS) };
}

/** Atomically records one attempt and returns the count in this window. */
export async function hit(key: string, now = Date.now()): Promise<number> {
  const { id, expiresAt } = windowKey(key, now);
  const doc = await AuthThrottle.findOneAndUpdate(
    { key: id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, returnDocument: "after", lean: true },
  );
  return doc!.count;
}

export async function peek(key: string, now = Date.now()): Promise<number> {
  const doc = await AuthThrottle.findOne({ key: windowKey(key, now).id }).lean();
  return doc?.count ?? 0;
}

export async function clear(key: string, now = Date.now()): Promise<void> {
  await AuthThrottle.deleteOne({ key: windowKey(key, now).id });
}
