/**
 * Payments are made outside Pacwoods (cash, transfer, POS); staff record them
 * here so the workshop has one place to see who has paid and who has been
 * paid. Amounts are optional and kept in minor units (kobo, cents): never
 * floating-point money.
 */
import { z } from "zod";

export const PAYMENT_METHODS = ["CASH", "TRANSFER", "POS", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { CASH: "Cash", TRANSFER: "Bank transfer", POS: "POS / card", OTHER: "Other" };

/** How much of a job a client payment covers, as the admin records it. */
export const CLIENT_COVERAGE = ["PART", "FULL"] as const;
export type ClientCoverage = (typeof CLIENT_COVERAGE)[number];

export const CLIENT_PAYMENT_STATUS = ["UNPAID", "PART", "FULL"] as const;
export type ClientPaymentStatus = (typeof CLIENT_PAYMENT_STATUS)[number];
export const CLIENT_PAYMENT_LABELS: Record<ClientPaymentStatus, string> = { UNPAID: "Not paid", PART: "Part paid", FULL: "Paid in full" };

/** Chosen by a Super Admin in Settings; until then amounts show without a symbol. */
export const CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "USD", "GBP", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

const MAX_MINOR = 1_000_000_000_000; // ten billion in major units: a typo guard, not a limit.

/** "15,000.50" -> 1500050 minor units; "" -> undefined. Throws on anything else. */
export function parseAmount(input: string): number | undefined {
  const s = input.replace(/[,\s]/g, "");
  if (s === "") return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error("Enter the amount as a number, for example 15000 or 15000.50.");
  const [whole, frac = ""] = s.split(".");
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (minor <= 0) throw new Error("The amount must be more than zero.");
  if (minor > MAX_MINOR) throw new Error("That amount is too large. Check the figure.");
  return minor;
}

export function formatMoney(minor: number | null | undefined, currency?: string | null) {
  if (minor == null) return "—";
  const major = minor / 100;
  if (currency) return new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 2 }).format(major);
  return new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(major);
}

const amountField = z
  .string()
  .max(30)
  .optional()
  .superRefine((v, ctx) => {
    try {
      parseAmount(v ?? "");
    } catch (e) {
      ctx.addIssue({ code: "custom", message: (e as Error).message });
    }
  });

const today = () => new Date().toISOString().slice(0, 10);

/** Fields shared by every payment entry, as typed into a form. */
const entryFields = {
  amount: amountField,
  method: z.enum([...PAYMENT_METHODS, ""]).optional(),
  note: z.string().trim().max(500).optional(),
  /** The day the money changed hands (YYYY-MM-DD); defaults to today. */
  paidOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date it was paid.")
    .refine((d) => d <= today(), "The date cannot be in the future.")
    .optional()
    .or(z.literal("")),
};

export const clientPaymentSchema = z.object({ coverage: z.enum(CLIENT_COVERAGE), ...entryFields });
export type ClientPaymentInput = z.infer<typeof clientPaymentSchema>;

export const operatorPaymentSchema = z.object(entryFields);
export type OperatorPaymentInput = z.infer<typeof operatorPaymentSchema>;

/** On the new-job form: whether the client has paid yet. */
export const jobPaymentSchema = z.object({ status: z.enum(CLIENT_PAYMENT_STATUS), ...entryFields });
export type JobPaymentInput = z.infer<typeof jobPaymentSchema>;
