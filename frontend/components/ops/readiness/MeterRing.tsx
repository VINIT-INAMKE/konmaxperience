import { cn } from '@/lib/utils';

/**
 * The one circular gauge in the app — a static SVG ring replacing Magic-UI's
 * animated circular progress bar (SPEC §6.4). Only the indicator's dash offset
 * transitions, and that transition is dropped under prefers-reduced-motion.
 *
 * Colour is passed in as an already-resolved token string (`var(--…)`) because an
 * SVG `stroke` cannot take a Tailwind utility.
 */

/** A 100×100 viewBox keeps the maths independent of the rendered size. */
const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface MeterRingProps {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  /** Indicator colour, e.g. `METER_TONE_VAR[tone]`. */
  toneVar: string;
  /** Unfilled remainder colour. */
  trackVar: string;
  strokeWidth?: number;
  /** Screen-reader label for the gauge, e.g. `"Kitchen readiness: 72 percent"`. */
  label: string;
  className?: string;
}

export function MeterRing({
  value,
  toneVar,
  trackVar,
  strokeWidth = 8,
  label,
  className,
}: MeterRingProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('size-full -rotate-90', className)}
      role="img"
      aria-label={label}
    >
      <circle
        cx="50"
        cy="50"
        r={RADIUS}
        fill="none"
        stroke={trackVar}
        strokeWidth={strokeWidth}
      />
      <circle
        cx="50"
        cy="50"
        r={RADIUS}
        fill="none"
        stroke={toneVar}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
        className="transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
      />
    </svg>
  );
}
