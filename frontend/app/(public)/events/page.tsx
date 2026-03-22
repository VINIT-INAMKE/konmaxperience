'use client';

import { useQuery } from '@tanstack/react-query';
import { BlurFade } from '@/components/ui/blur-fade';
import { Skeleton } from '@/components/ui/skeleton';
import { EventCard } from '@/components/public/EventCard';
import { apiClient } from '@/lib/api-client';
import type { Event } from '@/lib/types/events';

export default function EventsPage() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['public-events'],
    queryFn: () => apiClient.get<Event[]>('/events'),
  });

  return (
    <BlurFade direction="up">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold mb-8">Upcoming Experiences</h1>

        {isLoading && (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && (!events || events.length === 0) && (
          <div className="py-16 text-center space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">
              No upcoming events
            </h2>
            <p className="text-base text-gray-500">
              Check back soon &mdash; we&apos;re always planning something new.
            </p>
          </div>
        )}

        {!isLoading && events && events.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {events.map((event, index) => (
              <BlurFade key={event.id} delay={index * 0.05} direction="up">
                <EventCard event={event} />
              </BlurFade>
            ))}
          </div>
        )}
      </div>
    </BlurFade>
  );
}
