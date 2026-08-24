import { isQuietHour } from './quiet-hours';

const KOLKATA = 'Asia/Kolkata'; // UTC+5:30, no DST
const LONDON = 'Europe/London'; // UTC+0 in January, UTC+1 in July

/** The seeded window (`SETTING_DEFAULTS.notifications.quiet_hours`). */
const WRAPPING = { start: '21:00', end: '07:00' };

describe('isQuietHour', () => {
  describe('a window that wraps midnight', () => {
    it.each([
      ['23:00 node-local', '2026-08-24T17:30:00Z'],
      ['03:00 node-local', '2026-08-24T21:30:00Z'],
      ['00:00 node-local', '2026-08-24T18:30:00Z'],
    ])('is quiet at %s', (_label, instant) => {
      expect(isQuietHour(new Date(instant), KOLKATA, WRAPPING)).toBe(true);
    });

    it.each([
      ['12:00 node-local', '2026-08-24T06:30:00Z'],
      ['08:30 node-local', '2026-08-24T03:00:00Z'],
      ['20:59 node-local', '2026-08-24T15:29:00Z'],
    ])('is not quiet at %s', (_label, instant) => {
      expect(isQuietHour(new Date(instant), KOLKATA, WRAPPING)).toBe(false);
    });

    it('treats the interval as [start, end)', () => {
      // 21:00 IST — the first quiet minute.
      expect(
        isQuietHour(new Date('2026-08-24T15:30:00Z'), KOLKATA, WRAPPING),
      ).toBe(true);
      // 07:00 IST — the first minute a nudge may go out again.
      expect(
        isQuietHour(new Date('2026-08-24T01:30:00Z'), KOLKATA, WRAPPING),
      ).toBe(false);
      // 06:59 IST — still inside.
      expect(
        isQuietHour(new Date('2026-08-24T01:29:00Z'), KOLKATA, WRAPPING),
      ).toBe(true);
    });
  });

  describe('a window that does not wrap', () => {
    const window = { start: '01:00', end: '05:00' };

    it('is quiet inside and open outside', () => {
      // 03:00 IST
      expect(
        isQuietHour(new Date('2026-08-24T21:30:00Z'), KOLKATA, window),
      ).toBe(true);
      // 06:00 IST
      expect(
        isQuietHour(new Date('2026-08-24T00:30:00Z'), KOLKATA, window),
      ).toBe(false);
      // 23:00 IST — outside on the other side, and not wrapped into
      expect(
        isQuietHour(new Date('2026-08-24T17:30:00Z'), KOLKATA, window),
      ).toBe(false);
    });

    it('reads start === end as an empty window, never an always-quiet one', () => {
      const empty = { start: '12:00', end: '12:00' };
      expect(
        isQuietHour(new Date('2026-08-24T06:30:00Z'), KOLKATA, empty),
      ).toBe(false);
      expect(
        isQuietHour(new Date('2026-08-24T17:30:00Z'), KOLKATA, empty),
      ).toBe(false);
    });
  });

  it('samples the offset at the instant, so it is DST-correct', () => {
    const window = { start: '22:00', end: '06:00' };
    // 21:30 UTC is 22:30 BST in July (quiet) and 21:30 GMT in January (not).
    expect(isQuietHour(new Date('2026-07-01T21:30:00Z'), LONDON, window)).toBe(
      true,
    );
    expect(isQuietHour(new Date('2026-01-01T21:30:00Z'), LONDON, window)).toBe(
      false,
    );
  });

  describe('a malformed window fails open', () => {
    // `SettingsService.updateSetting` upserts raw JSON with no shape check, so
    // these are reachable states. Failing open means a badly timed nudge an
    // operator can see, not a silently muted channel nobody can.
    it.each([
      ['a missing bound', { start: '21:00' } as { start: string; end: string }],
      ['a non-time string', { start: 'evening', end: 'morning' }],
      ['an out-of-range hour', { start: '25:00', end: '07:00' }],
      ['an unpadded hour', { start: '9:00', end: '17:00' }],
      ['null', null],
      ['undefined', undefined],
    ])('returns false for %s', (_label, window) => {
      expect(
        isQuietHour(new Date('2026-08-24T17:30:00Z'), KOLKATA, window),
      ).toBe(false);
    });
  });
});
