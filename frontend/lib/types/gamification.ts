export const XP_LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, maxXp: 199, label: 'Starter' },
  { level: 2, minXp: 200, maxXp: 499, label: 'Builder' },
  { level: 3, minXp: 500, maxXp: 999, label: 'Achiever' },
  { level: 4, minXp: 1000, maxXp: Infinity, label: 'Master' },
] as const;

export const LEVEL_COLORS: Record<number, { text: string; bg: string; hex: string }> = {
  1: { text: 'text-slate-400', bg: 'bg-slate-400', hex: '#94a3b8' },
  2: { text: 'text-blue-400', bg: 'bg-blue-400', hex: '#60a5fa' },
  3: { text: 'text-purple-400', bg: 'bg-purple-400', hex: '#a78bfa' },
  4: { text: 'text-amber-400', bg: 'bg-amber-400', hex: '#fbbf24' },
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

export function getMeterColors(value: number): {
  primary: string;
  secondary: string;
  textClass: string;
} {
  if (value >= 70)
    return {
      primary: '#22c55e',
      secondary: '#14532d',
      textClass: 'text-green-500',
    };
  if (value >= 30)
    return {
      primary: '#f59e0b',
      secondary: '#78350f',
      textClass: 'text-amber-500',
    };
  return {
    primary: '#ef4444',
    secondary: '#7f1d1d',
    textClass: 'text-red-500',
  };
}
