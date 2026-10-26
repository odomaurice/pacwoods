import { z } from "zod";

export const ISSUE_STATUSES = ["OPEN", "RESOLVED"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_CATEGORIES = ["MATERIAL", "MACHINE", "CUTLIST", "QUALITY", "DELAY", "OTHER"] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  MATERIAL: "Material problem",
  MACHINE: "Machine or tool",
  CUTLIST: "Cutlist or sizes",
  QUALITY: "Quality or damage",
  DELAY: "Delay or timing",
  OTHER: "Something else",
};

export const issueReportSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  description: z.string().trim().min(5, "Describe the problem in a few words.").max(1000),
});
export type IssueReportInput = z.infer<typeof issueReportSchema>;

export const issueResolutionSchema = z.string().trim().min(5, "Say how it was resolved.").max(1000);
