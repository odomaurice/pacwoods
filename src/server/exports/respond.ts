import "server-only";
import { NextResponse } from "next/server";
import { safeFilename, toCsv, type Table } from "@/lib/export-table";
import { toXlsx } from "@/server/exports/xlsx";

/** Sends tables as a download: CSV (first table) or XLSX (all tables). */
export async function download(tables: Table[], baseName: string, format: string) {
  const name = safeFilename(baseName);
  if (format === "csv") {
    return new NextResponse(toCsv(tables[0]), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${name}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  }
  const buffer = await toXlsx(tables);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}.xlsx"`,
      "cache-control": "private, no-store",
    },
  });
}
