import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/guards";
import { markCut } from "@/server/services/production";
import { ServiceError } from "@/server/services/users";

const STATUS: Record<ServiceError["code"], number> = { FORBIDDEN: 403, INVALID: 400, DUPLICATE: 409, NOT_FOUND: 404, CONFLICT: 409 };

/**
 * Ticks a cut off (or back on) for the operator working the stage: JSON
 * { taskId, key, done }. The outbox sends cuts ticked offline here rather
 * than through the Server Action, whose id changes with every deploy.
 * Safe to repeat: it sets the state, it does not toggle it.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "Send JSON." }, { status: 415 });

  const body = (await request.json().catch(() => null)) as { taskId?: unknown; key?: unknown; done?: unknown } | null;
  if (!body || typeof body.taskId !== "string" || !mongoose.isValidObjectId(body.taskId) || typeof body.key !== "string" || typeof body.done !== "boolean") {
    return NextResponse.json({ error: "Unknown cut." }, { status: 400 });
  }
  try {
    await markCut({ id: user.id, role: user.role }, body.taskId, body.key, body.done);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: STATUS[error.code] });
    throw error;
  }
}
