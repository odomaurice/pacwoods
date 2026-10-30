import { describe, expect, it } from "vitest";
import { convertText, fromMm, toMm } from "@/lib/units";

describe("length units", () => {
  it("converts typed sizes to millimetres, to 0.1 mm", () => {
    expect(toMm(72, "cm")).toBe(720);
    expect(toMm(2.44, "m")).toBe(2440);
    expect(toMm(24, "in")).toBe(609.6);
    expect(toMm(8, "ft")).toBe(2438.4);
    expect(toMm(Number.NaN, "cm")).toBeNaN();
  });

  it("shows millimetres in any unit without trailing zeros", () => {
    expect(fromMm(720, "cm")).toBe("72");
    expect(fromMm(2440, "m")).toBe("2.44");
    expect(fromMm(609.6, "in")).toBe("24");
    expect(fromMm(2438.4, "ft")).toBe("8");
  });

  it("re-expresses typed text when the unit changes, leaving non-numbers alone", () => {
    expect(convertText("72", "cm", "mm")).toBe("720");
    expect(convertText("", "cm", "mm")).toBe("");
    expect(convertText("abc", "cm", "mm")).toBe("abc");
    expect(convertText("8", "ft", "in")).toBe("96");
  });
});
