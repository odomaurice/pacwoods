import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/guards";
import { deletePhoto, openPhoto } from "@/server/services/photos";
import { ServiceError } from "@/server/services/users";

/** A photo's image, only for people allowed to see its job. */
export async function GET(request: Request, { params }: RouteContext<"/api/photos/[id]">) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const size = new URL(request.url).searchParams.get("size") === "thumb" ? "thumb" : "full";
  const stream = await openPhoto(user, id, size);
  if (!stream) return new NextResponse(null, { status: 404 });
  return new NextResponse(stream, {
    headers: {
      "content-type": "image/webp",
      // Private: never stored by shared caches. Photo bytes never change.
      "cache-control": "private, max-age=86400, immutable",
    },
  });
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/photos/[id]">) {
  const user = await getSessionUser();
  if (!user || user.role === "CLIENT") return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { id } = await params;
  try {
    await deletePhoto(user, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 409 });
    throw error;
  }
}
