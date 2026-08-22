/** Prisma `EventType`. */
export type EventType = 'dining' | 'workshop' | 'pop_up' | 'tasting' | 'other';
/** Prisma `EventStatus`. */
export type EventStatus = 'draft' | 'upcoming' | 'live' | 'past' | 'cancelled';
/** Prisma `BookingStatus` — the seat's lifecycle, independent of `payment_status`. */
export type BookingStatus = 'held' | 'confirmed' | 'cancelled' | 'attended' | 'no_show';
/** Free-string payment state on EventBooking (not yet a Prisma enum). */
export type BookingPaymentStatus = 'pending' | 'paid' | 'refunded' | 'free';

export interface EventBooking {
  id: string;
  event_id: string;
  customer_name: string;
  customer_phone: string;
  customer_id?: string | null;
  guests: number;
  status: BookingStatus;
  /** Set while `status` is `held`; the seat is released after this instant. */
  hold_expires_at: string | null;
  payment_status: BookingPaymentStatus;
  payment_amount: number | null;
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

export const EVENT_STATUSES: EventStatus[] = ['draft', 'upcoming', 'live', 'past', 'cancelled'];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  upcoming: 'Upcoming',
  live: 'Live',
  past: 'Past',
  cancelled: 'Cancelled',
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  held: 'Held',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  attended: 'Attended',
  no_show: 'No Show',
};

export const BOOKING_PAYMENT_STATUS_LABELS: Record<BookingPaymentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  refunded: 'Refunded',
  free: 'Free',
};
