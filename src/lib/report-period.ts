const DAY = 24 * 60 * 60 * 1000;

/**
 * A report period from ?from=YYYY-MM-DD&to=YYYY-MM-DD, inclusive of both
 * days. Defaults to the last 30 days; at most a year.
 */
export function reportPeriod(fromParam: string | null | undefined, toParam: string | null | undefined, now = new Date()) {
  const valid = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null);
  const toDay = valid(toParam) ?? now.toISOString().slice(0, 10);
  let fromDay = valid(fromParam) ?? new Date(Date.parse(toDay) - 29 * DAY).toISOString().slice(0, 10);
  if (fromDay > toDay) fromDay = toDay;
  if (Date.parse(toDay) - Date.parse(fromDay) > 366 * DAY) fromDay = new Date(Date.parse(toDay) - 366 * DAY).toISOString().slice(0, 10);
  return {
    from: new Date(`${fromDay}T00:00:00.000Z`),
    to: new Date(`${toDay}T23:59:59.999Z`),
    fromDay,
    toDay,
    label: `${fromDay}-to-${toDay}`,
  };
}
