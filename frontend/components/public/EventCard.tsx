'use client';

import Link from 'next/link';
import { MagicCard } from '@/components/ui/magic-card';
import { Badge } from '@/components/ui/badge';
import { CapacityBadge } from '@/components/public/CapacityBadge';
import type { Event } from '@/lib/types/events';
import { EVENT_TYPE_LABELS } from '@/lib/types/events';

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const formattedDate = new Date(event.date).toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Link href={`/events/${event.id}`}>
      <MagicCard className="rounded-xl cursor-pointer">
        <div className="p-4 space-y-3">
          <h3 className="text-xl font-semibold">{event.title}</h3>
          <p className="text-sm text-gray-500">{formattedDate}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">
              {EVENT_TYPE_LABELS[event.event_type]}
            </Badge>
            <span className="text-sm">Rs. {event.price}</span>
            <CapacityBadge spotsRemaining={event.spots_remaining ?? 0} />
          </div>
          {(event.zone || event.brand) && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {event.zone && <span>{event.zone.name}</span>}
              {event.zone && event.brand && <span>&middot;</span>}
              {event.brand && <span>{event.brand.name}</span>}
            </div>
          )}
        </div>
      </MagicCard>
    </Link>
  );
}
