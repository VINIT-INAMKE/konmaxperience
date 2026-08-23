import { cn } from '@/lib/utils';

interface ProgressRingProps {
  /** Current value. */
  value: number;
  /** Value that represents a full ring. Defaults to 100. */
  max?: number;
  /** Sizing/typography classes for the wrapper (e.g. `size-12 text-xs`). */
  className?: string;
  /** Render the rounded percentage in the middle of the ring. */
  showValue?: boolean;
  /** Ring colour — any CSS colour *token*, never a raw hue. */
  indicatorColor?: string;
  /** Track colour — any CSS colour *token*, never a raw hue. */
  trackColor?: string;
  /** Accessible label; when omitted the ring is decorative (`aria-hidden`). */
  label?: string;
}

/**
 * Static SVG progress ring — the token-clean replacement for the Magic-UI circular
 * gauge that SPEC §6.4 removes from the motion allowlist.
 * No animation, so no `motion-reduce` guard is required.
 */
export function ProgressRing({
  value,
  max = 100,
  className,
  showValue = true,
  indicatorColor = 'var(--accent)',
  trackColor = 'var(--line-strong)',
  label,
}: ProgressRingProps) {
  const safeMax = max === 0 ? 100 : max;
  const percent = Math.max(0, Math.min(100, Math.round((value / safeMax) * 100)));
  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={cn('relative size-40 font-semibold', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 100 100" fill="none" className="size-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          strokeWidth="10"
          strokeLinecap="round"
          style={{ stroke: trackColor }}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
          style={{ stroke: indicatorColor }}
        />
      </svg>
      {showValue && (
        <span className="absolute inset-0 m-auto size-fit tabular-nums">{percent}</span>
      )}
    </div>
  );
}
