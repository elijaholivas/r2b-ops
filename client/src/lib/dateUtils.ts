/**
 * Date formatting utilities for R2B Class Operations
 *
 * IMPORTANT: Class datetimes are stored in the database as UTC timestamps,
 * but the values represent local Pacific time (i.e., an 8:00 AM class is
 * stored as 08:00:00 UTC, not 15:00:00 UTC). This means we must display
 * them using UTC methods, NOT the browser's local timezone conversion.
 *
 * Use these helpers for any class startDatetime / endDatetime display.
 * For system timestamps (createdAt, updatedAt, lastSignedIn), use regular
 * date formatting since those are true UTC values.
 */

import { format } from "date-fns";

/**
 * Parse a class datetime value into a Date object, preserving the UTC
 * wall-clock time as the intended local time.
 *
 * e.g. "2026-01-14T08:00:00.000Z" → displays as "8:00 AM" regardless of
 * the browser's timezone.
 */
export function parseClassDatetime(value: string | Date): Date {
  const d = value instanceof Date ? value : new Date(value);
  // Re-interpret the UTC time components as local time by constructing
  // a new Date using the UTC year/month/day/hour/minute/second values.
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds()
  );
}

/** Format a class datetime with a date-fns format string */
export function formatClassDatetime(
  value: string | Date,
  fmt: string
): string {
  return format(parseClassDatetime(value), fmt);
}

/** "Wed, Jan 14 · 8:00 AM" */
export function formatClassShort(value: string | Date): string {
  return formatClassDatetime(value, "EEE, MMM d · h:mm a");
}

/** "Wednesday, January 14, 2026" */
export function formatClassDateLong(value: string | Date): string {
  return formatClassDatetime(value, "EEEE, MMMM d, yyyy");
}

/** "Jan 14, 2026" */
export function formatClassDateMedium(value: string | Date): string {
  return formatClassDatetime(value, "MMM d, yyyy");
}

/** "8:00 AM" */
export function formatClassTime(value: string | Date): string {
  return formatClassDatetime(value, "h:mm a");
}

/** "Jan 14, 2026 · 8:00 AM" */
export function formatClassDateTimeMedium(value: string | Date): string {
  return formatClassDatetime(value, "MMM d, yyyy · h:mm a");
}

/** "Wed, Jan 14, 2026 · 8:00 AM" */
export function formatClassDateTimeFull(value: string | Date): string {
  return formatClassDatetime(value, "EEE, MMM d, yyyy · h:mm a");
}

/**
 * Format a date range for display.
 * Same-day: "Wed, Jan 14 · 8:00 AM – 4:00 PM"
 * Multi-day: "Sat, Jan 24 – Sun, Jan 25"
 */
export function formatClassDateRange(
  start: string | Date,
  end: string | Date
): string {
  const s = parseClassDatetime(start);
  const e = parseClassDatetime(end);
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();

  if (sameDay) {
    return `${format(s, "EEE, MMM d")} · ${format(s, "h:mm a")} – ${format(e, "h:mm a")}`;
  }
  return `${format(s, "EEE, MMM d")} – ${format(e, "EEE, MMM d")}`;
}
