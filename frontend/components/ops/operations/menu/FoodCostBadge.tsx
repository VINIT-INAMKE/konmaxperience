interface FoodCostBadgeProps {
  percent: number | null;
}

export function FoodCostBadge({ percent }: FoodCostBadgeProps) {
  if (percent === null) {
    return (
      <span className="text-xs text-muted-foreground">Cost not available</span>
    );
  }

  if (percent < 30) {
    return (
      <span className="inline-flex h-8 items-center text-xs font-semibold text-green-500">
        {percent.toFixed(1)}% food cost
      </span>
    );
  }

  if (percent <= 40) {
    return (
      <span className="inline-flex h-8 items-center text-xs font-semibold text-amber-500">
        {percent.toFixed(1)}% food cost
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 items-center text-xs font-semibold text-red-500">
      {percent.toFixed(1)}% food cost
    </span>
  );
}
