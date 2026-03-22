'use client';

import { Pencil, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Event } from '@/lib/types/events';
import { EVENT_TYPE_LABELS, EVENT_STATUS_LABELS } from '@/lib/types/events';

interface EventRowProps {
  event: Event;
  onEdit: () => void;
  onViewBookings: () => void;
  onDelete: () => void;
}

export function EventRow({ event, onEdit, onViewBookings, onDelete }: EventRowProps) {
  const bookedGuests = event.booked_guests ?? 0;
  const fillPercent = Math.min(100, (bookedGuests / event.capacity) * 100);

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      {/* Title */}
      <td className="px-4 py-3 text-sm font-medium">{event.title}</td>

      {/* Date */}
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {new Date(event.date).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </td>

      {/* Type */}
      <td className="px-4 py-3">
        <Badge variant="secondary" className="text-xs">
          {EVENT_TYPE_LABELS[event.event_type]}
        </Badge>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge
          variant={event.status === 'cancelled' ? 'destructive' : 'secondary'}
          className="text-xs"
        >
          {EVENT_STATUS_LABELS[event.status]}
        </Badge>
      </td>

      {/* Capacity fill */}
      <td className="px-4 py-3">
        <div className="space-y-1">
          <div className="text-sm">
            {bookedGuests} / {event.capacity}
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
      </td>

      {/* Bookings button */}
      <td className="px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={onViewBookings}
        >
          <Users className="size-3.5" />
          Bookings
        </Button>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
