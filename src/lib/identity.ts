/**
 * Sign-in identifiers: an email address or a phone number. Clients may have
 * only a phone number, so both are first-class.
 */

export type Identifier =
  | { kind: "email"; value: string }
  | { kind: "phone"; value: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string | null {
  const value = input.trim().toLowerCase();
  return EMAIL.test(value) ? value : null;
}

/** Calling code for numbers typed the local way: DEFAULT_CALLING_CODE, else Nigeria (234). */
export const CALLING_CODE = process.env.DEFAULT_CALLING_CODE || "234";

/**
 * Normalises to E.164 (`+2348012345678`) for storage and sign-in. People type
 * numbers the local way (0803 123 4567, or 803 123 4567); international
 * numbers (+44…, 0044…) still work. Pass "" to accept only international ones.
 */
export function normalizePhone(input: string, defaultCallingCode: string = CALLING_CODE): string | null {
  const compact = input.trim().replace(/[\s().-]/g, "");
  let digits: string;

  if (compact.startsWith("+")) {
    digits = compact.slice(1);
  } else if (compact.startsWith("00")) {
    digits = compact.slice(2);
  } else if (compact.startsWith("0") && defaultCallingCode) {
    digits = defaultCallingCode + compact.slice(1);
  } else if (/^[1-9]\d{9}$/.test(compact) && defaultCallingCode) {
    // The national number without its leading 0.
    digits = defaultCallingCode + compact;
  } else {
    return null;
  }

  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

/**
 * A stored number as people write it locally: +2348031234567 → 0803 123 4567.
 * Numbers from other countries keep their international form.
 */
export function formatPhone(e164: string | null | undefined, callingCode: string = CALLING_CODE): string {
  if (!e164) return "";
  if (!callingCode || !e164.startsWith(`+${callingCode}`)) return e164;
  const national = `0${e164.slice(callingCode.length + 1)}`;
  return national.length === 11 ? `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}` : national;
}

export function parseIdentifier(input: string): Identifier | null {
  if (input.includes("@")) {
    const value = normalizeEmail(input);
    return value ? { kind: "email", value } : null;
  }
  const value = normalizePhone(input);
  return value ? { kind: "phone", value } : null;
}
