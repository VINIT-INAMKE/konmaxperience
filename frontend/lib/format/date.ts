/**
 * Date and duration rendering for the storefront and the staff commerce screens.
 *
 * **Every formatter pins `timeZone: 'Asia/Kolkata'`.** The storefront's product,
 * shop and experience pages are server components, so a date is formatted once
 * on the server and again on the client during hydration; without a pinned zone
 * those two runs disagree whenever the server is UTC and the visitor is not, and
 * React reports a hydration mismatch on what is only a formatting difference.
 * The business is in one timezone, so pinning it is also simply correct.
 *
 * Every input is an ISO 8601 string — that is what a `@db.Timestamptz(3)` column
 * serialises to. `null`/`undefined`/unparseable input renders as an em dash
 * rather than `Invalid Date`.
 */

export const IST = 'Asia/Kolkata';

const EM_DASH = '—';

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const DATE_LONG_FMT = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const TIME_FMT = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const DATE_TIME_FMT = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const RELATIVE_FMT = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

type DateInput = string | number | Date | null | undefined;

/** Parses anything the API can hand back into a `Date`, or `null`. */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `24 Aug 2026`. */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  return date ? DATE_FMT.format(date) : EM_DASH;
}

/** `Mon, 24 August 2026` — for an experience's headline date. */
export function formatDateLong(value: DateInput): string {
  const date = toDate(value);
  return date ? DATE_LONG_FMT.format(date) : EM_DASH;
}

/** `7:45 pm`. */
export function formatTime(value: DateInput): string {
  const date = toDate(value);
  return date ? TIME_FMT.format(date) : EM_DASH;
}

/** `24 Aug 2026, 7:45 pm`. */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  return date ? DATE_TIME_FMT.format(date) : EM_DASH;
}

/** An ISO date without a time — what an `<input type="date">` wants. */
export function toDateInputValue(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '';
  // `en-CA` renders ISO order (YYYY-MM-DD) and honours the pinned zone, which
  // slicing `toISOString()` would not.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * `2 hours ago`, `in 3 days`.
 *
 * **Not for a server component**: the answer depends on `Date.now()`, so it
 * differs between the server render and hydration. Render it in an effect, or
 * pass an explicit `now`.
 */
export function formatRelative(value: DateInput, now: number = Date.now()): string {
  const date = toDate(value);
  if (!date) return EM_DASH;
  const delta = date.getTime() - now;
  const abs = Math.abs(delta);
  if (abs < MINUTE) return 'just now';
  if (abs < HOUR) return RELATIVE_FMT.format(Math.round(delta / MINUTE), 'minute');
  if (abs < DAY) return RELATIVE_FMT.format(Math.round(delta / HOUR), 'hour');
  if (abs < 30 * DAY) return RELATIVE_FMT.format(Math.round(delta / DAY), 'day');
  return formatDate(date);
}

/** Milliseconds until an instant, floored at zero. */
export function msUntil(value: DateInput, now: number = Date.now()): number {
  const date = toDate(value);
  if (!date) return 0;
  return Math.max(0, date.getTime() - now);
}

/** True once the instant has passed. A missing instant counts as expired. */
export function isExpired(value: DateInput, now: number = Date.now()): boolean {
  const date = toDate(value);
  return date === null || date.getTime() <= now;
}

/**
 * `mm:ss` for the checkout's 15-minute quote countdown (P5a decision 3), and
 * `h:mm:ss` for anything longer — a booking hold, a coupon window.
 */
export function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/** `2–4 days` from a courier ETD, or `null` when the provider gave none. */
export function formatEtd(value: DateInput, now: number = Date.now()): string | null {
  const date = toDate(value);
  if (!date) return null;
  const days = Math.ceil((date.getTime() - now) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
