/**
 * Server-side date formatting utilities for R2B Class Operations
 *
 * IMPORTANT: Class datetimes are stored in the database as UTC timestamps,
 * but the values represent local Pacific time (i.e., an 8:00 AM class is
 * stored as 08:00:00 UTC, not 15:00:00 UTC).
 *
 * DO NOT use toLocaleString with a timeZone option on these values — that
 * would shift the time by 7–8 hours and show the wrong time in emails.
 * Instead, read the UTC components directly to get the intended wall-clock time.
 */

/**
 * Re-interpret a class datetime's UTC components as the intended local wall-clock time.
 * e.g. "2026-01-14T08:00:00.000Z" → a Date that formats as "8:00 AM" in any timezone.
 */
export function parseClassDatetime(value: string | Date): Date {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds()
  );
}

/** "Wednesday, January 14, 2026" */
export function formatClassDateLong(value: string | Date): string {
  return parseClassDatetime(value).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "January 14, 2026" */
export function formatClassDateMedium(value: string | Date): string {
  return parseClassDatetime(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "8:00 AM" */
export function formatClassTime(value: string | Date): string {
  return parseClassDatetime(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
