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
    <Badge variant="outline" className="text-gray-400">
      Sold Out
    </Badge>
  );
}
