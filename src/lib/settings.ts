import { z } from "zod";
import { DEFAULT_OPTIONS, ESTIMATE_ASSUMPTIONS } from "@/lib/cutlist";

/** Common time zones; the workshop's local time is used for greetings and dates. */
export const TIME_ZONES = ["UTC", "Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "Africa/Cairo", "Europe/London"] as const;

const num = (label: string, min: number, max: number) =>
  z.number({ error: `${label}: enter a number.` }).min(min, `${label}: at least ${min}.`).max(max, `${label}: at most ${max}.`);

export const settingsSchema = z.object({
  kerf: num("Kerf", 0, 10),
  edgeTrim: num("Edge trim", 0, 50),
  edgeBandThickness: num("Edge-band thickness", 0, 5),
  sheetHandlingMin: num("Minutes per sheet", 0, 60),
  secondsPerCut: num("Seconds per cut", 0, 600),
  edgingMetresPerMin: num("Edgebander speed", 0.5, 60),
  secondsPerBandedEdge: num("Seconds per banded edge", 0, 600),
  timeZone: z.enum(TIME_ZONES),
});
export type Settings = z.infer<typeof settingsSchema>;

/** Used until a Super Admin saves the workshop's own figures. */
export const DEFAULT_SETTINGS: Settings = {
  kerf: DEFAULT_OPTIONS.kerf,
  edgeTrim: DEFAULT_OPTIONS.edgeTrim,
  edgeBandThickness: DEFAULT_OPTIONS.edgeBandThickness,
  ...ESTIMATE_ASSUMPTIONS,
  timeZone: "UTC",
};

export function estimateAssumptions(s: Settings) {
  return {
    sheetHandlingMin: s.sheetHandlingMin,
    secondsPerCut: s.secondsPerCut,
    edgingMetresPerMin: s.edgingMetresPerMin,
    secondsPerBandedEdge: s.secondsPerBandedEdge,
  };
}
