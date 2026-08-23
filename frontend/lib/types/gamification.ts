export const XP_LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, maxXp: 199, label: 'Starter' },
  { level: 2, minXp: 200, maxXp: 499, label: 'Builder' },
  { level: 3, minXp: 500, maxXp: 999, label: 'Achiever' },
  { level: 4, minXp: 1000, maxXp: Infinity, label: 'Master' },
] as const;

/**
 * Level 1→4 reads as a progression, not a status — so the ramp climbs the brand
 * token layer (stone → info → olive → gold) rather than a raw Tailwind hue.
 * `fill` is a solid background paired with its own ink token, so the label clears
 * AA in both themes without a hard-coded `text-white` (SPEC §7).
 */
export const LEVEL_COLORS: Record<number, { text: string; fill: string }> = {
  1: { text: 'text-ink-subtle', fill: 'bg-surface-raised text-ink-subtle' },
  2: { text: 'text-info-status', fill: 'bg-info-status text-info-status-ink' },
  3: { text: 'text-leaf', fill: 'bg-leaf text-leaf-ink' },
  4: { text: 'text-gold-text', fill: 'bg-gold text-gold-ink' },
};

export function getXpForNextLevel(
  currentXp: number,
): { current: number; target: number; percent: number } {
  const threshold =
    XP_LEVEL_THRESHOLDS.find((t) => currentXp <= t.maxXp) ??
    XP_LEVEL_THRESHOLDS[3];
  const prevMax =
    threshold.level === 1
      ? 0
      : XP_LEVEL_THRESHOLDS[threshold.level - 2].maxXp + 1;
  const range =
    threshold.maxXp === Infinity ? 1000 : threshold.maxXp + 1 - prevMax;
  const progress = currentXp - prevMax;
  return {
    current: progress,
    target: range,
    percent: Math.min(Math.round((progress / range) * 100), 100),
  };
}
