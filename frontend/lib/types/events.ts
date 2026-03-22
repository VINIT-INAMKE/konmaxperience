export type EventType = 'dining' | 'workshop' | 'pop_up' | 'tasting' | 'other';
export type EventStatus = 'upcoming' | 'past' | 'cancelled';

export interface EventBooking {
  id: string;
  event_id: string;
  customer_name: string;
  customer_phone: string;
  guests: number;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  event_type: EventType;
  date: string;
  capacity: number;
  price: number;
  zone_id: string | null;
  brand_id: string | null;
  description: string | null;
  image_url: string | null;
  status: EventStatus;
  created_at: string;
  updated_at: string;
  zone?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  bookings?: EventBooking[];
  booked_guests?: number;
  spots_remaining?: number;
}

export interface CreateEventPayload {
  title: string;
  event_type: EventType;
  date: string;
  capacity: number;
  price: number;
  zone_id?: string;
  brand_id?: string;
  description?: string;
  image_url?: string;
}

export interface UpdateEventPayload extends Partial<CreateEventPayload> {
  status?: EventStatus;
}

export interface CreateBookingPayload {
  customer_name: string;
  customer_phone: string;
  guests: number;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  dining: 'Dining',
  workshop: 'Workshop',
  pop_up: 'Pop-Up',
  tasting: 'Tasting',
  other: 'Other',
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  upcoming: 'Upcoming',
  past: 'Past',
  cancelled: 'Cancelled',
};
