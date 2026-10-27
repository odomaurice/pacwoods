import { describe, expect, it } from "vitest";
import { guardFormula, safeFilename, toCsv } from "@/lib/export-table";
import { reportPeriod } from "@/lib/report-period";

describe("CSV", () => {
  it("escapes quotes, commas and line breaks, with CRLF rows and a BOM", () => {
    const csv = toCsv({ name: "t", headers: ["a", "b"], rows: [['Door, "big"', 1], ["line\nbreak", null]] });
    expect(csv).toBe('﻿a,b\r\n"Door, ""big""",1\r\n"line\nbreak",\r\n');
  });

  it("neutralises cells that would run as formulas", () => {
    for (const bad of ["=1+1", "+1", "-2", "@SUM(A1)", "\tx"]) expect(guardFormula(bad)).toBe(`'${bad}`);
    expect(guardFormula("Door")).toBe("Door");
    expect(toCsv({ name: "t", headers: ["x"], rows: [[-5]] })).toContain("\r\n-5\r\n"); // numbers stay numbers
  });

  it("makes safe file names", () => {
    expect(safeFilename("PAC-2026-000001 cutlist v2 approved")).toBe("PAC-2026-000001-cutlist-v2-approved");
  });
});

describe("report period", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  it("defaults to the last 30 days, inclusive", () => {
    const p = reportPeriod(null, null, now);
    expect(p.fromDay).toBe("2026-09-28");
    expect(p.toDay).toBe("2026-10-27");
    expect(p.to.toISOString()).toBe("2026-10-27T23:59:59.999Z");
  });
  it("ignores junk, swaps nothing silently, and caps at a year", () => {
    expect(reportPeriod("nonsense", "2026-10-01", now).fromDay).toBe("2026-09-02");
    expect(reportPeriod("2026-11-01", "2026-10-01", now).fromDay).toBe("2026-10-01");
    expect(reportPeriod("2020-01-01", "2026-10-01", now).fromDay).toBe("2025-09-30");
  });
});
