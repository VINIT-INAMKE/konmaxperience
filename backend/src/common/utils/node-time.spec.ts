import {
  formatDateInNodeTz,
  formatInNodeTz,
  nodeDateRange,
  nodeDayKey,
  nodeDayRange,
  nodeMonthStart,
  tzOffsetMinutes,
} from './node-time';

/**
 * Every expectation here is an absolute UTC instant, so the suite passes with the
 * machine timezone unset, with `TZ=UTC`, and with `TZ=Asia/Kolkata`. That is the
 * point: nothing in `node-time.ts` may read the process timezone.
 */
describe('node-time', () => {
  // ---------------------------------------------------------------
  // tzOffsetMinutes
  // ---------------------------------------------------------------
  describe('tzOffsetMinutes', () => {
    it('is +330 for IST all year (India has no DST)', () => {
      expect(
        tzOffsetMinutes('Asia/Kolkata', new Date('2026-01-15T00:00:00Z')),
      ).toBe(330);
      expect(
        tzOffsetMinutes('Asia/Kolkata', new Date('2026-07-15T00:00:00Z')),
      ).toBe(330);
    });

    it('follows DST in Europe/London', () => {
      expect(
        tzOffsetMinutes('Europe/London', new Date('2026-01-01T12:00:00Z')),
      ).toBe(0);
      expect(
        tzOffsetMinutes('Europe/London', new Date('2026-07-01T12:00:00Z')),
      ).toBe(60);
    });

    it('is exact either side of the London spring-forward instant', () => {
      // BST begins 2026-03-29 at 01:00 UTC.
      expect(
        tzOffsetMinutes('Europe/London', new Date('2026-03-29T00:59:59Z')),
      ).toBe(0);
      expect(
        tzOffsetMinutes('Europe/London', new Date('2026-03-29T01:00:00Z')),
      ).toBe(60);
    });

    it('is 0 for UTC and negative west of Greenwich', () => {
      expect(tzOffsetMinutes('UTC', new Date('2026-08-23T00:00:00Z'))).toBe(0);
      expect(
        tzOffsetMinutes('America/New_York', new Date('2026-08-23T12:00:00Z')),
      ).toBe(-240);
    });
  });

  // ---------------------------------------------------------------
  // nodeDayKey
  // ---------------------------------------------------------------
  describe('nodeDayKey', () => {
    it('keeps 23:30 IST (18:00 UTC) on the same IST day', () => {
      expect(nodeDayKey('Asia/Kolkata', new Date('2026-08-22T18:00:00Z'))).toBe(
        '2026-08-22',
      );
    });

    it('rolls over at 18:30 UTC, the IST midnight', () => {
      expect(
        nodeDayKey('Asia/Kolkata', new Date('2026-08-22T18:29:59.999Z')),
      ).toBe('2026-08-22');
      expect(
        nodeDayKey('Asia/Kolkata', new Date('2026-08-22T18:30:00.000Z')),
      ).toBe('2026-08-23');
    });

    it('buckets a 20:00 UTC order into the next IST day', () => {
      expect(nodeDayKey('Asia/Kolkata', new Date('2026-08-22T20:00:00Z'))).toBe(
        '2026-08-23',
      );
    });

    it('gives a different key per zone for one instant', () => {
      const at = new Date('2026-08-22T20:00:00Z');
      expect(nodeDayKey('UTC', at)).toBe('2026-08-22');
      expect(nodeDayKey('Asia/Kolkata', at)).toBe('2026-08-23');
      expect(nodeDayKey('America/New_York', at)).toBe('2026-08-22');
      // +14: the earliest zone on earth is already two days past New York.
      expect(nodeDayKey('Pacific/Kiritimati', at)).toBe('2026-08-23');
    });

    it('pads single-digit months and days', () => {
      expect(nodeDayKey('UTC', new Date('2026-01-05T12:00:00Z'))).toBe(
        '2026-01-05',
      );
    });
  });

  // ---------------------------------------------------------------
  // nodeDayRange
  // ---------------------------------------------------------------
  describe('nodeDayRange', () => {
    it('bounds an IST day at 18:30 UTC either side', () => {
      const { start, end } = nodeDayRange('Asia/Kolkata', '2026-08-23');
      expect(start.toISOString()).toBe('2026-08-22T18:30:00.000Z');
      expect(end.toISOString()).toBe('2026-08-23T18:30:00.000Z');
    });

    it('includes 23:30 IST and excludes the next IST midnight', () => {
      const { start, end } = nodeDayRange('Asia/Kolkata', '2026-08-22');
      const lateEvening = new Date('2026-08-22T18:00:00Z'); // 23:30 IST
      const nextMidnight = new Date('2026-08-22T18:30:00Z'); // 00:00 IST, 23rd
      expect(lateEvening >= start).toBe(true);
      expect(lateEvening < end).toBe(true);
      expect(nextMidnight < end).toBe(false);
    });

    it('bounds a UTC day at midnight UTC', () => {
      const { start, end } = nodeDayRange('UTC', '2026-08-23');
      expect(start.toISOString()).toBe('2026-08-23T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-08-24T00:00:00.000Z');
    });

    it('bounds a British Summer Time day at 23:00 UTC', () => {
      const { start, end } = nodeDayRange('Europe/London', '2026-07-15');
      expect(start.toISOString()).toBe('2026-07-14T23:00:00.000Z');
      expect(end.toISOString()).toBe('2026-07-15T23:00:00.000Z');
    });

    it('makes the London spring-forward day 23 hours long', () => {
      const { start, end } = nodeDayRange('Europe/London', '2026-03-29');
      expect(start.toISOString()).toBe('2026-03-29T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-03-29T23:00:00.000Z');
      expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
    });

    it('makes the London fall-back day 25 hours long', () => {
      const { start, end } = nodeDayRange('Europe/London', '2026-10-25');
      expect(start.toISOString()).toBe('2026-10-24T23:00:00.000Z');
      expect(end.toISOString()).toBe('2026-10-26T00:00:00.000Z');
      expect(end.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
    });

    it('crosses a month boundary', () => {
      const { start, end } = nodeDayRange('Asia/Kolkata', '2026-08-31');
      expect(start.toISOString()).toBe('2026-08-30T18:30:00.000Z');
      expect(end.toISOString()).toBe('2026-08-31T18:30:00.000Z');
    });

    it('accepts a full ISO datetime and uses its date part', () => {
      const { start } = nodeDayRange(
        'Asia/Kolkata',
        '2026-08-23T11:45:00.000Z',
      );
      expect(start.toISOString()).toBe('2026-08-22T18:30:00.000Z');
    });

    it('rejects a string that is not a date', () => {
      expect(() => nodeDayRange('Asia/Kolkata', 'yesterday')).toThrow(
        RangeError,
      );
    });

    it('round-trips with nodeDayKey', () => {
      const day = '2026-02-28';
      for (const zone of ['Asia/Kolkata', 'Europe/London', 'UTC']) {
        const { start, end } = nodeDayRange(zone, day);
        expect(nodeDayKey(zone, start)).toBe(day);
        expect(nodeDayKey(zone, new Date(end.getTime() - 1))).toBe(day);
        expect(nodeDayKey(zone, end)).not.toBe(day);
      }
    });
  });

  // ---------------------------------------------------------------
  // nodeDateRange
  // ---------------------------------------------------------------
  describe('nodeDateRange', () => {
    it('spans from the first day start to the last day end', () => {
      const { start, end } = nodeDateRange(
        'Asia/Kolkata',
        '2026-08-01',
        '2026-08-03',
      );
      expect(start.toISOString()).toBe('2026-07-31T18:30:00.000Z');
      expect(end.toISOString()).toBe('2026-08-03T18:30:00.000Z');
    });

    it('covers exactly one day when from equals to', () => {
      const { start, end } = nodeDateRange(
        'Asia/Kolkata',
        '2026-08-23',
        '2026-08-23',
      );
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('absorbs the lost hour when the range covers a DST transition', () => {
      const { start, end } = nodeDateRange(
        'Europe/London',
        '2026-03-28',
        '2026-03-29',
      );
      expect(start.toISOString()).toBe('2026-03-28T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-03-29T23:00:00.000Z');
      expect(end.getTime() - start.getTime()).toBe(47 * 60 * 60 * 1000);
    });
  });

  // ---------------------------------------------------------------
  // nodeMonthStart
  // ---------------------------------------------------------------
  describe('nodeMonthStart', () => {
    it('returns IST month start, not UTC month start', () => {
      expect(
        nodeMonthStart(
          'Asia/Kolkata',
          new Date('2026-08-15T12:00:00Z'),
        ).toISOString(),
      ).toBe('2026-07-31T18:30:00.000Z');
    });

    it('uses the node-local month for an instant that straddles the boundary', () => {
      // 2026-08-01T02:00Z is still 2026-07-31 22:00 in New York.
      expect(
        nodeMonthStart(
          'America/New_York',
          new Date('2026-08-01T02:00:00Z'),
        ).toISOString(),
      ).toBe('2026-07-01T04:00:00.000Z');
      expect(
        nodeMonthStart('UTC', new Date('2026-08-01T02:00:00Z')).toISOString(),
      ).toBe('2026-08-01T00:00:00.000Z');
    });
  });

  // ---------------------------------------------------------------
  // formatters
  // ---------------------------------------------------------------
  describe('formatInNodeTz', () => {
    const boundary = new Date('2026-08-22T20:00:00Z'); // 01:30 IST on the 23rd

    it('renders the instant in the given zone, not the process zone', () => {
      const ist = formatInNodeTz('Asia/Kolkata', boundary);
      const utc = formatInNodeTz('UTC', boundary);
      expect(ist).toContain('23');
      expect(utc).toContain('22');
      expect(ist).not.toBe(utc);
    });

    it('renders a 12-hour clock and the year', () => {
      const out = formatInNodeTz('Asia/Kolkata', boundary);
      expect(out).toContain('2026');
      expect(out).toMatch(/\b(am|pm)\b/i);
    });

    it('accepts an ISO string as well as a Date', () => {
      expect(formatInNodeTz('Asia/Kolkata', boundary.toISOString())).toBe(
        formatInNodeTz('Asia/Kolkata', boundary),
      );
    });
  });

  describe('formatDateInNodeTz', () => {
    it('renders the node-local date for a cross-midnight instant', () => {
      const boundary = new Date('2026-08-22T20:00:00Z');
      expect(formatDateInNodeTz('Asia/Kolkata', boundary)).not.toBe(
        formatDateInNodeTz('UTC', boundary),
      );
      expect(formatDateInNodeTz('Asia/Kolkata', boundary)).toContain('23');
      expect(formatDateInNodeTz('UTC', boundary)).toContain('22');
    });
  });
});
