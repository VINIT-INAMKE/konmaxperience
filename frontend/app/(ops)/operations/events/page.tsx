'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EventForm } from '@/components/ops/operations/events/EventForm';
import { EventRow } from '@/components/ops/operations/events/EventRow';
import { BookingListSheet } from '@/components/ops/operations/events/BookingListSheet';
import { apiClient } from '@/lib/api-client';
import type { Event } from '@/lib/types/events';
import { ExportButton } from '@/components/ops/exports/ExportButton';

export default function EventsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | undefined>(undefined);
  const [bookingsEventId, setBookingsEventId] = useState<string | null>(null);
  const [bookingsEventName, setBookingsEventName] = useState('');
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: events,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['ops-events'],
    queryFn: () => apiClient.get<Event[]>('/events/all'),
  });

  const handleCreate = () => {
    setEditingEvent(undefined);
    setFormOpen(true);
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingEvent(undefined);
  };

  const handleViewBookings = (event: Event) => {
    setBookingsEventId(event.id);
    setBookingsEventName(event.title);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEvent) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/events/${deletingEvent.id}`);
      toast.success('Event deleted.');
      void queryClient.invalidateQueries({ queryKey: ['ops-events'] });
      setDeletingEvent(null);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaved = () => {
    void queryClient.invalidateQueries({ queryKey: ['ops-events'] });
  };

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Experience Events</h1>
          <div className="flex items-center gap-2">
            <ExportButton
              reportType="events"
              reportName="Events"
              isTimeSeries={false}
            />
            <Button onClick={handleCreate}>Create Event</Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading events...</div>
        )}

        {/* Error state */}
        {isError && (
          <div className="text-sm text-destructive">
            Couldn&apos;t load events. Refresh the page to try again.
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && events && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <CalendarDays className="size-12 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold">No Events Created</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Create an event to start collecting bookings.
            </p>
          </div>
        )}

        {/* Events table */}
        {!isLoading && !isError && events && events.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Bookings
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onEdit={() => handleEdit(event)}
                    onViewBookings={() => handleViewBookings(event)}
                    onDelete={() => setDeletingEvent(event)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Event create/edit Sheet */}
        <EventForm
          open={formOpen}
          event={editingEvent}
          onOpenChange={handleFormOpenChange}
          onSaved={handleSaved}
        />

        {/* Booking list Sheet */}
        <BookingListSheet
          eventId={bookingsEventId}
          eventName={bookingsEventName}
          open={!!bookingsEventId}
          onOpenChange={(o) => {
            if (!o) setBookingsEventId(null);
          }}
        />

        {/* Delete confirmation Dialog */}
        <Dialog
          open={!!deletingEvent}
          onOpenChange={(open) => {
            if (!open) setDeletingEvent(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete event</DialogTitle>
              <DialogDescription>
                This will permanently remove the event and all its bookings. This
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeletingEvent(null)}
                disabled={isDeleting}
              >
                Keep Event
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteConfirm()}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Event'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
