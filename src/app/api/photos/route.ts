import { NextResponse } from "next/server";
import { PHOTO_KINDS, type PhotoKind } from "@/lib/photos";
import { getSessionUser } from "@/server/auth/guards";
import { savePhoto } from "@/server/services/photos";
import { ServiceError } from "@/server/services/users";

const STATUS: Record<ServiceError["code"], number> = { FORBIDDEN: 403, INVALID: 400, DUPLICATE: 409, NOT_FOUND: 404, CONFLICT: 409 };

/** Upload one photo (multipart: file, workNumber, kind, taskId?). */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (user.role === "CLIENT") return NextResponse.json({ error: "Clients cannot add photos." }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  const workNumber = String(form.get("workNumber") ?? "");
  const kind = String(form.get("kind") ?? "") as PhotoKind;
  const taskId = form.get("taskId") ? String(form.get("taskId")) : undefined;
  if (!(file instanceof File) || !PHOTO_KINDS.includes(kind)) return NextResponse.json({ error: "Missing photo." }, { status: 400 });

  try {
    const photo = await savePhoto(user, { workNumber, kind, taskId, data: Buffer.from(await file.arrayBuffer()) });
    return NextResponse.json({ id: photo._id.toString() }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: STATUS[error.code] });
    throw error;
  }
}
