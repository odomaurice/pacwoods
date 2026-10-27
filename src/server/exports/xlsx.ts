import "server-only";
import writeExcelFile from "write-excel-file/node";
import { guardFormula, type Table } from "@/lib/export-table";

/** One workbook, one sheet per table, bold header row, sensible widths. */
export async function toXlsx(tables: Table[]): Promise<Buffer> {
  const data = tables.map((t) => [
    t.headers.map((h) => ({ value: h, fontWeight: "bold" as const })),
    ...t.rows.map((row) =>
      row.map((v) => {
        if (v === null || v === undefined) return null;
        if (v instanceof Date) return { value: v, type: Date, format: "yyyy-mm-dd hh:mm" };
        if (typeof v === "number") return { value: v, type: Number };
        return { value: guardFormula(v), type: String };
      }),
    ),
  ]);
  // Several sheets go in as an array of { data, sheet, columns } objects.
  const sheets = tables.map((t, i) => ({
    data: data[i],
    sheet: t.name.slice(0, 31),
    columns: t.headers.map((h, j) => ({ width: t.widths?.[j] ?? Math.min(40, Math.max(10, h.length + 2)) })),
  }));
  return (await writeExcelFile(sheets as never).toBuffer()) as Buffer;
}
