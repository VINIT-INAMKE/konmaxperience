'use client';

import { Badge } from '@/components/ui/badge';

interface CapacityBadgeProps {
  spotsRemaining: number;
}

export function CapacityBadge({ spotsRemaining }: CapacityBadgeProps) {
  if (spotsRemaining > 0) {
    return <Badge variant="secondary">{spotsRemaining} spots left</Badge>;
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      Sold Out
    </Badge>
  );
}
