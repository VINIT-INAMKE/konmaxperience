'use client';

import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Badge } from '@/components/ui/badge';
import { CapacityBadge } from '@/components/public/CapacityBadge';
import { EventBookingForm } from '@/components/public/EventBookingForm';
import { apiClient } from '@/lib/api-client';
import { EVENT_TYPE_LABELS } from '@/lib/types/events';
import type { Event } from '@/lib/types/events';

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();

  const {
    data: event,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['public-event', id],
    queryFn: () => apiClient.get<Event>(`/events/${id}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">
          Event not found
        </h2>
        <p className="text-base text-gray-500">
          This event may have been removed or the link may be incorrect.
        </p>
      </div>
    );
  }

  const formattedDate = new Date(event.date).toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleBooked = () => {
    void queryClient.invalidateQueries({ queryKey: ['public-event', id] });
  };

  return (
    <BlurFade direction="up">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Image or placeholder */}
          <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
            {event.image_url ? (
              <Image
                src={event.image_url}
                alt={event.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-lg font-semibold text-gray-400">
                  {EVENT_TYPE_LABELS[event.event_type]}
                </span>
              </div>
            )}
          </div>

          {/* Event details + booking */}
          <div className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold">{event.title}</h1>
              <p className="text-sm text-gray-500">{formattedDate}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">
                  {EVENT_TYPE_LABELS[event.event_type]}
                </Badge>
                <span className="text-sm font-normal">
                  Rs. {event.price}
                </span>
                <CapacityBadge
                  spotsRemaining={event.spots_remaining ?? 0}
                />
              </div>
              {event.description && (
                <p className="text-base text-gray-700">{event.description}</p>
              )}
              {(event.zone || event.brand) && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {event.zone && <span>{event.zone.name}</span>}
                  {event.zone && event.brand && <span>&middot;</span>}
                  {event.brand && <span>{event.brand.name}</span>}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Book Your Spot</h2>
              <EventBookingForm
                eventId={event.id}
                eventDate={event.date}
                spotsRemaining={event.spots_remaining ?? 0}
                onBooked={handleBooked}
              />
            </div>
          </div>
        </div>
      </div>
    </BlurFade>
  );
}
