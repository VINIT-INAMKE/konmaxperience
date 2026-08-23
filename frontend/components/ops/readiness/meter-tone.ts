/**
 * Meter value → status tone. Colour lives in `app/tokens.css`; this file maps a
 * 0-100 reading to the status *meaning*, so light and dark both resolve from the
 * same token and no component declares a raw colour (SPEC §7).
 */
export type MeterTone = 'good' | 'warning' | 'serious';

export function meterTone(value: number): MeterTone {
  if (value >= 70) return 'good';
  if (value >= 30) return 'warning';
  return 'serious';
}

/** For SVG `stroke` / inline `style`, where a class cannot be used. */
export const METER_TONE_VAR: Record<MeterTone, string> = {
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  serious: 'var(--status-serious)',
};

export const METER_TONE_TEXT: Record<MeterTone, string> = {
  good: 'text-good',
  warning: 'text-warning',
  serious: 'text-serious',
};

export const METER_TONE_FILL: Record<MeterTone, string> = {
  good: 'bg-good',
  warning: 'bg-warning',
  serious: 'bg-serious',
};

/** The unfilled remainder of a ring or bar. */
export const METER_TRACK_VAR = 'var(--surface-sunken)';
