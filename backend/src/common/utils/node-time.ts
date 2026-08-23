/**
 * Day-boundary, day-key and display helpers that take the node's IANA timezone
 * instead of the process timezone.
 *
 * `process.env.TZ = 'Asia/Kolkata'` used to be forced in `main.ts`; it is gone so
 * that a node in another zone reports its own days (SPEC 3.1 `Node.timezone`).
 * Resolve the zone with `NodeService.timezone()` and pass it in — never read
 * `process.env.TZ`, and never rely on the machine's local time.
 *
 * Everything here is built on `Intl.DateTimeFormat` (no extra dependency) and is
 * DST-correct: offsets are sampled at the instant in question, and a local day is
 * bounded by the *next* local midnight rather than by "start + 24h", so 23-hour
 * and 25-hour days come out right.
 */

/** Matches the leading `YYYY-MM-DD` of a date or full ISO datetime string. */
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

/** Split a `YYYY-MM-DD` (or ISO datetime) string into numeric parts. */
function parseDay(day: string): { y: number; m: number; d: number } {
  const match = DAY_PATTERN.exec(day);
  if (!match) {
    throw new RangeError(
      `Expected a YYYY-MM-DD date string, received "${day}"`,
    );
  }
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/**
 * Offset of `at` in `timeZone`, in minutes east of UTC. DST-aware: the answer is
 * for that instant, not for the zone in general (`Europe/London` is 0 in January
 * and 60 in July).
 */
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(at).map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // en-US with hour12:false renders midnight as "24" in some ICU versions.
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * `YYYY-MM-DD` for `at` as seen in `timeZone` — the analytics day-bucket key.
 * `en-CA` is the locale whose short date format *is* ISO-8601.
 */
export function nodeDayKey(timeZone: string, at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** The UTC instant at which the local day `YYYY-MM-DD` begins in `timeZone`. */
function startOfNodeDay(timeZone: string, day: string): Date {
  const { y, m, d } = parseDay(day);
  const naive = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  // Two passes: the offset sampled at the naive instant can belong to the wrong
  // side of a DST transition, so re-sample at the candidate instant. Where local
  // midnight does not exist (spring-forward at 00:00) this lands on 01:00 local,
  // which is the conventional resolution.
  const firstPass = naive - tzOffsetMinutes(timeZone, new Date(naive)) * 60000;
  const secondPass =
    naive - tzOffsetMinutes(timeZone, new Date(firstPass)) * 60000;
  return new Date(secondPass);
}

/** `YYYY-MM-DD` shifted by whole days, using UTC arithmetic on the calendar parts. */
function shiftDay(day: string, days: number): string {
  const { y, m, d } = parseDay(day);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * UTC instants bounding the local day `YYYY-MM-DD` in `timeZone`.
 * `start` is inclusive, `end` is exclusive — filter with `{ gte: start, lt: end }`.
 */
export function nodeDayRange(
  timeZone: string,
  day: string,
): { start: Date; end: Date } {
  return {
    start: startOfNodeDay(timeZone, day),
    end: startOfNodeDay(timeZone, shiftDay(day, 1)),
  };
}

/**
 * UTC instants spanning the local days `from`..`to` inclusive in `timeZone`.
 * `start` is inclusive, `end` is exclusive.
 */
export function nodeDateRange(
  timeZone: string,
  from: string,
  to: string,
): { start: Date; end: Date } {
  return {
    start: nodeDayRange(timeZone, from).start,
    end: nodeDayRange(timeZone, to).end,
  };
}

/** UTC instant at which the local month containing `at` begins in `timeZone`. */
export function nodeMonthStart(timeZone: string, at: Date): Date {
  return startOfNodeDay(timeZone, `${nodeDayKey(timeZone, at).slice(0, 8)}01`);
}

/** Display formatter for receipts and notices, rendered in the node's zone. */
export function formatInNodeTz(
  timeZone: string,
  at: Date | string,
  locale = 'en-IN',
): string {
  const date = typeof at === 'string' ? new Date(at) : at;
  return date.toLocaleString(locale, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** Date-only display formatter, rendered in the node's zone. */
export function formatDateInNodeTz(
  timeZone: string,
  at: Date | string,
  locale = 'en-IN',
): string {
  const date = typeof at === 'string' ? new Date(at) : at;
  return date.toLocaleDateString(locale, { timeZone });
}
