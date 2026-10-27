import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/guards";
import { download } from "@/server/exports/respond";
import { productionReport, productionTables } from "@/server/exports/reports";
import { reportPeriod } from "@/lib/report-period";

/** Completed production work in a period. Staff only. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return new NextResponse(null, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const { from, to, label } = reportPeriod(sp.get("from"), sp.get("to"));
  const tables = productionTables(await productionReport(from, to));
  return download(sp.get("format") === "csv" ? [tables[0]] : tables, `pacwoods-production-${label}`, sp.get("format") === "csv" ? "csv" : "xlsx");
}
