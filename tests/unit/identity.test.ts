import { describe, expect, it } from "vitest";
import { formatPhone, normalizeEmail, normalizePhone, parseIdentifier } from "@/lib/identity";

describe("normalizePhone", () => {
  it("keeps international numbers, stripping formatting", () => {
    expect(normalizePhone("+234 801-234 5678")).toBe("+2348012345678");
    expect(normalizePhone("(+44) 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("00447700900123")).toBe("+447700900123");
  });

  it("uses the default calling code only for national numbers", () => {
    expect(normalizePhone("08012345678", "234")).toBe("+2348012345678");
    expect(normalizePhone("08012345678", "")).toBeNull();
  });

  it("defaults to Nigeria, with or without the leading 0", () => {
    expect(normalizePhone("0803 123 4567")).toBe("+2348031234567");
    expect(normalizePhone("803 123 4567")).toBe("+2348031234567");
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
  });
});

describe("formatPhone", () => {
  it("shows local numbers the local way, others as stored", () => {
    expect(formatPhone("+2348031234567")).toBe("0803 123 4567");
    expect(formatPhone("+447700900123")).toBe("+447700900123");
    expect(formatPhone(undefined)).toBe("");
  });

  it("rejects implausible numbers", () => {
    expect(normalizePhone("+0123456789")).toBeNull();
    expect(normalizePhone("+12345")).toBeNull();
    expect(normalizePhone("+1234567890123456")).toBeNull();
    expect(normalizePhone("+23480abc")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("lower-cases and trims", () => {
    expect(normalizeEmail("  Jane@Example.COM ")).toBe("jane@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
  });
});

describe("parseIdentifier", () => {
  it("tells emails from phone numbers", () => {
    expect(parseIdentifier("a@b.co")).toEqual({ kind: "email", value: "a@b.co" });
    expect(parseIdentifier("+2348012345678")).toEqual({ kind: "phone", value: "+2348012345678" });
    expect(parseIdentifier("nonsense")).toBeNull();
  });
});
