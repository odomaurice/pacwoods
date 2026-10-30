/**
 * Form and action schemas, shared by the browser (React Hook Form) and the
 * server (actions and services). The server always re-validates.
 */
import { z } from "zod";
import { jobPaymentSchema } from "@/lib/payments";
import { CAPABILITIES, PERMISSIONS } from "@/lib/roles";

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const GRAINS = ["NONE", "LENGTHWISE"] as const;
export type Grain = (typeof GRAINS)[number];

const optionalText = (max: number) => z.string().trim().max(max).optional();

const contact = {
  name: z.string().trim().min(2, "Enter a name.").max(160),
  phone: optionalText(32),
  email: optionalText(254),
};

const contactRequired = <T extends { phone?: string; email?: string }>(v: T) =>
  Boolean(v.phone?.trim() || v.email?.trim());
const contactMessage = { path: ["phone"], message: "Enter a phone number or an email address." };

export const staffAccountSchema = z
  .object({
    role: z.enum(["ADMIN", "OPERATOR"]),
    ...contact,
    permissions: z.array(z.enum(PERMISSIONS)),
    capabilities: z.array(z.enum(CAPABILITIES)),
  })
  .refine(contactRequired, contactMessage)
  .refine((v) => v.role !== "OPERATOR" || v.capabilities.length > 0, {
    path: ["capabilities"],
    message: "Choose at least one capability.",
  });
export type StaffAccountInput = z.infer<typeof staffAccountSchema>;

export const clientAccountSchema = z
  .object({
    ...contact,
    businessName: optionalText(160),
    address: optionalText(500),
    staffNotes: optionalText(2000),
  })
  .refine(contactRequired, contactMessage);
export type ClientAccountInput = z.infer<typeof clientAccountSchema>;

export const accountActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("status"), userId: z.string(), status: z.enum(USER_STATUSES) }),
  z.object({ kind: z.literal("reset"), userId: z.string() }),
  z.object({ kind: z.literal("revoke"), userId: z.string() }),
]);
export type AccountActionInput = z.infer<typeof accountActionSchema>;

const mm = (max: number) =>
  z.number({ error: "Enter a number." }).positive("Must be greater than 0.").max(max, `At most ${max} mm.`);

export const materialSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  category: z.string().trim().min(1, "Enter a category.").max(60),
  thicknessMm: mm(200),
  grain: z.enum(GRAINS),
  sheetLengthMm: mm(10000),
  sheetWidthMm: mm(10000),
  supplier: optionalText(120),
});
export type MaterialInput = z.infer<typeof materialSchema>;

export const jobDetailsSchema = z
  .object({
    title: optionalText(160),
    cutting: z.boolean(),
    edging: z.boolean(),
    /** CNC machining between cutting and edging (drilling, routing, grooves). */
    cnc: z.boolean().optional(),
    clientNotes: optionalText(2000),
    internalNotes: optionalText(2000),
  })
  // Edging-only jobs wait on a business decision (Phase 0, open question 3).
  .refine((v) => v.cutting, {
    path: ["cutting"],
    message: "Every job needs cutting for now; edging-only jobs are not supported yet.",
  });
export type JobDetailsInput = z.infer<typeof jobDetailsSchema>;

export const jobSchema = jobDetailsSchema.and(
  z.object({
    clientId: z.string().min(1, "Choose a client."),
    /** Ticked when the boards for this job are already in the workshop. */
    materialsAvailable: z.boolean().optional(),
    /** Whether the client has paid yet (payments happen outside Pacwoods). */
    payment: jobPaymentSchema.optional(),
  }),
);
export type JobInput = z.infer<typeof jobSchema>;
