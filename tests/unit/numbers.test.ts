import { describe, expect, it } from "vitest";
import { describeOperations } from "@/lib/jobs";
import { CLIENT_NUMBER_PATTERN, WORK_NUMBER_PATTERN, formatClientNumber, formatWorkNumber } from "@/lib/numbers";
import { jobSchema, staffAccountSchema } from "@/lib/schemas";

describe("identifiers", () => {
  it("formats work and client numbers", () => {
    expect(formatWorkNumber(2026, 1)).toBe("PAC-2026-000001");
    expect(formatWorkNumber(2026, 123456)).toBe("PAC-2026-123456");
    expect(formatClientNumber(42)).toBe("PCL-000042");
    expect(WORK_NUMBER_PATTERN.test(formatWorkNumber(2026, 7))).toBe(true);
    expect(CLIENT_NUMBER_PATTERN.test(formatClientNumber(7))).toBe(true);
    expect(WORK_NUMBER_PATTERN.test("PAC-2026-1")).toBe(false);
  });
});

describe("job schema", () => {
  const base = { clientId: "abc", cutting: true, edging: false };
  it("accepts cutting-only and cutting + edging", () => {
    expect(jobSchema.safeParse(base).success).toBe(true);
    expect(jobSchema.safeParse({ ...base, edging: true }).success).toBe(true);
  });
  it("rejects edging-only until the business rule is decided", () => {
    expect(jobSchema.safeParse({ ...base, cutting: false, edging: true }).success).toBe(false);
  });
  it("requires a client", () => {
    expect(jobSchema.safeParse({ ...base, clientId: "" }).success).toBe(false);
  });
  it("describes operations", () => {
    expect(describeOperations({ cutting: true, edging: true })).toBe("Cutting and edging");
    expect(describeOperations({ cutting: true, edging: false })).toBe("Cutting only");
  });
});

describe("staff account schema", () => {
  it("requires a contact and, for operators, a capability", () => {
    const op = { role: "OPERATOR" as const, name: "Op", phone: "+2348000000000", permissions: [], capabilities: [] };
    expect(staffAccountSchema.safeParse(op).success).toBe(false);
    expect(staffAccountSchema.safeParse({ ...op, capabilities: ["CUTTING"] }).success).toBe(true);
    expect(staffAccountSchema.safeParse({ ...op, phone: "", capabilities: ["CUTTING"] }).success).toBe(false);
  });
});
