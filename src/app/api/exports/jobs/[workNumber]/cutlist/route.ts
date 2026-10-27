import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/guards";
import { download } from "@/server/exports/respond";
import { cutlistTables } from "@/server/exports/reports";

/** A job's cutlist as CSV (panels) or XLSX (panels, stock, plan). */
export async function GET(request: Request, { params }: RouteContext<"/api/exports/jobs/[workNumber]/cutlist">) {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return new NextResponse(null, { status: 401 });
  const { workNumber } = await params;
  const found = await cutlistTables(workNumber, user);
  if (!found) return new NextResponse(null, { status: 404 });
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";
  return download(found.tables, `${found.workNumber}-cutlist-${found.tag}`, format);
}
