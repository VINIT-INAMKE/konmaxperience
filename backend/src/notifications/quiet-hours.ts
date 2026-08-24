import { tzOffsetMinutes } from '../common/utils/node-time';

/** A node-local `HH:mm`–`HH:mm` window, as stored in `SystemSetting['notifications']`. */
export interface QuietHoursWindow {
  start: string;
  end: string;
}

/** Strict `HH:mm` (00:00–23:59). Anything else is a malformed setting, not a time. */
const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Minutes since node-local midnight for an `HH:mm` string, or `null` when the
 * string is not one. `SettingsService.updateSetting` performs no shape check
 * (it upserts raw JSON), so a hand-edited window can reach here as `undefined`.
 */
function minutesOfDay(hhmm: string | undefined): number | null {
  const match = HHMM_PATTERN.exec(hhmm ?? '');
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * True when `at`, read in `timeZone`, falls inside the configured window.
 *
 * Windows wrap midnight (the seeded `21:00`–`07:00` does), so the comparison is
 * on minutes-of-day with a wrap branch rather than on `Date` ordering. The
 * interval is half-open — `[start, end)` — so a `07:00` end means 07:00 is the
 * first minute a nudge may go out again, and `start === end` is an empty window
 * (never quiet) rather than an always-quiet one.
 *
 * `node-time.ts`'s `formatInNodeTz` renders a display string with a fixed
 * options bag rather than accepting one, so the local clock is derived from
 * `tzOffsetMinutes` instead (decision: `node-time.ts` has no P6 owner and is
 * never edited). That offset is sampled *at* `at`, so the answer is DST-correct.
 *
 * A malformed window returns `false`. Quiet hours only ever *suppress* the
 * WhatsApp leg (decision 11); failing open means a bad setting produces a badly
 * timed nudge, which an operator sees and fixes, rather than a silently muted
 * channel, which nobody sees at all.
 */
export function isQuietHour(
  at: Date,
  timeZone: string,
  window: QuietHoursWindow | null | undefined,
): boolean {
  const start = minutesOfDay(window?.start);
  const end = minutesOfDay(window?.end);
  if (start === null || end === null) return false;

  const local =
    Math.floor(at.getTime() / 60000) + tzOffsetMinutes(timeZone, at);
  const now = ((local % 1440) + 1440) % 1440;

  return start <= end ? now >= start && now < end : now >= start || now < end;
}
