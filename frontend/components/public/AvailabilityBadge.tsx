'use client';

import { Badge } from '@/components/ui/badge';

interface AvailabilityBadgeProps {
  available: boolean;
}

export function AvailabilityBadge({ available }: AvailabilityBadgeProps) {
  if (available) {
    return <Badge variant="default">Available</Badge>;
  }

  return (
    <Badge variant="secondary" className="text-gray-400">
      Sold Out
    </Badge>
  );
}
