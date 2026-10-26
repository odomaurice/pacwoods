/** Human-readable identifiers. Sequences come from the atomic Counter. */

export function formatWorkNumber(year: number, seq: number): string {
  return `PAC-${year}-${String(seq).padStart(6, "0")}`;
}

export function formatClientNumber(seq: number): string {
  return `PCL-${String(seq).padStart(6, "0")}`;
}

/** Work numbers restart each year (open question 18; proposed default). */
export function workNumberCounter(year: number): string {
  return `job:${year}`;
}

export const WORK_NUMBER_PATTERN = /^PAC-\d{4}-\d{6}$/;
export const CLIENT_NUMBER_PATTERN = /^PCL-\d{6}$/;
