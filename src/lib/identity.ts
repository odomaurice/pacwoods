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

/**
 * Normalises to E.164 (`+2348012345678`). A national number starting with 0
 * needs DEFAULT_CALLING_CODE (digits only, e.g. "234"); the country default is
 * an open business question, so without it only `+` numbers are accepted.
 */
export function normalizePhone(
  input: string,
  defaultCallingCode = process.env.DEFAULT_CALLING_CODE,
): string | null {
  const compact = input.trim().replace(/[\s().-]/g, "");
  let digits: string;

  if (compact.startsWith("+")) {
    digits = compact.slice(1);
  } else if (compact.startsWith("00")) {
    digits = compact.slice(2);
  } else if (compact.startsWith("0") && defaultCallingCode) {
    digits = defaultCallingCode + compact.slice(1);
  } else {
    return null;
  }

  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

export function parseIdentifier(input: string): Identifier | null {
  if (input.includes("@")) {
    const value = normalizeEmail(input);
    return value ? { kind: "email", value } : null;
  }
  const value = normalizePhone(input);
  return value ? { kind: "phone", value } : null;
}
