'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import type { EventBooking } from '@/lib/types/events';

interface BookingListSheetProps {
  eventId: string | null;
  eventName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookingListSheet({
  eventId,
  eventName,
  open,
  onOpenChange,
}: BookingListSheetProps) {
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['event-bookings', eventId],
    queryFn: () =>
      apiClient.get<EventBooking[]>('/events/' + eventId + '/bookings'),
    enabled: !!eventId && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Bookings for {eventName}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 px-4 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2 p-3 rounded-lg border">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && bookings && bookings.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No bookings yet for this event.
              </p>
            </div>
          )}

          {!isLoading && bookings && bookings.length > 0 && (
            <div className="space-y-2">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="text-sm font-medium">{booking.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {booking.customer_phone}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {booking.guests} guest{booking.guests !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(booking.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
