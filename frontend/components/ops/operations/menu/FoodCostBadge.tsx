interface FoodCostBadgeProps {
  percent: number | null;
}

/** Food-cost ramp: under 30% is healthy, 30–40% needs watching, above 40% is a problem. */
function foodCostClass(percent: number): string {
  if (percent < 30) return 'text-good';
  if (percent <= 40) return 'text-warning';
  return 'text-serious';
}

export function FoodCostBadge({ percent }: FoodCostBadgeProps) {
  if (percent === null) {
    return (
      <span className="text-xs text-ink-muted">Cost not available</span>
    );
  }

  return (
    <span
      className={`inline-flex h-8 items-center text-xs font-semibold ${foodCostClass(percent)}`}
    >
      {percent.toFixed(1)}% food cost
    </span>
  );
}
