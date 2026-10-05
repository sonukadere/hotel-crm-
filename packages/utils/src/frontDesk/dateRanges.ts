import { parseISODate, formatDateToISO } from "../dates";

/**
 * Half-open interval semantics used across the front desk:
 * a stay occupies nights [checkIn, checkOut) so the departure day is released
 * for the next arrival. This mirrors hotel night-audit business rules.
 */
export interface DateRange {
  start: string;
  end: string;
}

/** Normalises any date input to a UTC midnight timestamp for safe comparisons. */
export function toUtcDayStart(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
  return parseISODate(value);
}

/** Normalises any date input to a `YYYY-MM-DD` string. */
export function toISODay(value: string | Date): string {
  return formatDateToISO(toUtcDayStart(value));
}

/** Formats a UTC-midnight-anchored epoch timestamp as `YYYY-MM-DD`. */
export function timestampToISODay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * True when two half-open date ranges share at least one night.
 * Adjacent stays (one departs the day the next arrives) do NOT overlap.
 */
export function doDateRangesOverlap(
  a: { start: string | Date; end: string | Date },
  b: { start: string | Date; end: string | Date },
): boolean {
  const aStart = toUtcDayStart(a.start).getTime();
  const aEnd = toUtcDayStart(a.end).getTime();
  const bStart = toUtcDayStart(b.start).getTime();
  const bEnd = toUtcDayStart(b.end).getTime();

  return aStart < bEnd && bStart < aEnd;
}

/**
 * Clips a stay to a visible tape-chart window so grid bars never overflow.
 * Returns null when the stay does not intersect the window at all.
 */
export function clipRangeToWindow(
  stay: { start: string | Date; end: string | Date },
  window: { start: string | Date; end: string | Date },
): DateRange | null {
  const stayStart = toUtcDayStart(stay.start).getTime();
  const stayEnd = toUtcDayStart(stay.end).getTime();
  const windowStart = toUtcDayStart(window.start).getTime();
  const windowEnd = toUtcDayStart(window.end).getTime();

  if (stayStart >= windowEnd || stayEnd <= windowStart) return null;

  return {
    start: timestampToISODay(Math.max(stayStart, windowStart)),
    end: timestampToISODay(Math.min(stayEnd, windowEnd)),
  };
}

/** Every calendar day covered by the half-open range [start, end). */
export function eachDayInRange(range: { start: string | Date; end: string | Date }): string[] {
  const days: string[] = [];
  const start = toUtcDayStart(range.start);
  const end = toUtcDayStart(range.end);

  if (start.getTime() >= end.getTime()) return [formatDateToISO(start)];

  const cursor = new Date(start.getTime());
  while (cursor.getTime() < end.getTime()) {
    days.push(formatDateToISO(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** Number of nights in a half-open range, floored at one night. */
export function countNights(range: { start: string | Date; end: string | Date }): number {
  const start = toUtcDayStart(range.start).getTime();
  const end = toUtcDayStart(range.end).getTime();
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
}

export function shiftDays(value: string | Date, days: number): string {
  const date = toUtcDayStart(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateToISO(date);
}
