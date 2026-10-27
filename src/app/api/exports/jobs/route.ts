import { NextResponse } from "next/server";
import { JOB_STATUSES } from "@/lib/jobs";
import { getSessionUser } from "@/server/auth/guards";
import { download } from "@/server/exports/respond";
import { jobListTable } from "@/server/exports/reports";

/** The jobs list, with the same filters as the Jobs page. Staff only. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return new NextResponse(null, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const status = (JOB_STATUSES as readonly string[]).includes(sp.get("status") ?? "") ? sp.get("status")! : "";
  const table = await jobListTable({ q: (sp.get("q") ?? "").slice(0, 100), status });
  return download([table], `pacwoods-jobs-${new Date().toISOString().slice(0, 10)}`, sp.get("format") === "csv" ? "csv" : "xlsx");
}
