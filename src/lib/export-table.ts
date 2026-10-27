/** A sheet of data that can be written as CSV or as one sheet of an XLSX. */
export type Cell = string | number | Date | null | undefined;
export type Table = { name: string; headers: string[]; rows: Cell[][]; widths?: number[] };

/**
 * A text cell starting with = + - @ (or tab/CR) would run as a formula when
 * opened in a spreadsheet; prefix it with an apostrophe so it stays text.
 */
export function guardFormula(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: Cell) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : typeof value === "number" ? String(value) : guardFormula(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with CRLF line endings and a BOM so Excel reads UTF-8. */
export function toCsv(table: Table) {
  const lines = [table.headers, ...table.rows].map((row) => row.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function safeFilename(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
