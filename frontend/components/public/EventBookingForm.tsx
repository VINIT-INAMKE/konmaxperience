'use client';

import { useState } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, ApiError } from '@/lib/api-client';

interface EventBookingFormProps {
  eventId: string;
  eventDate: string;
  spotsRemaining: number;
  onBooked: () => void;
}

export function EventBookingForm({
  eventId,
  eventDate,
  spotsRemaining,
  onBooked,
}: EventBookingFormProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [guests, setGuests] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const formattedDate = new Date(eventDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (spotsRemaining <= 0 && !booked) {
    return (
      <div className="rounded-lg border bg-muted p-6 text-center">
        <p className="text-base text-muted-foreground">This event is sold out</p>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="rounded-lg border border-success/20 bg-success/10 p-6 text-center" role="status">
        <p className="text-base text-success">
          You&apos;re in! See you on {formattedDate}.
        </p>
      </div>
    );
  }

  const isValid =
    customerName.trim().length >= 1 &&
    customerPhone.trim().length >= 5 &&
    guests >= 1 &&
    guests <= spotsRemaining;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/events/${eventId}/bookings`, {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        guests,
      });
      setBooked(true);
      onBooked();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError(
          `This event just sold out — no spots left for ${guests} guests.`
        );
      } else {
        setError(
          "Booking didn't go through — check your connection and try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecrement = () => {
    setGuests((prev) => Math.max(1, prev - 1));
  };

  const handleIncrement = () => {
    setGuests((prev) => Math.min(spotsRemaining, prev + 1));
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="booking-name" className="text-sm text-foreground">
          Your name
        </label>
        <Input
          id="booking-name"
          placeholder="Your name"
          required
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="bg-background border-input text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="booking-phone" className="text-sm text-foreground">
          Phone number
        </label>
        <Input
          id="booking-phone"
          type="tel"
          placeholder="Your phone number"
          required
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          className="bg-background border-input text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="booking-guests" className="text-sm text-foreground">
          Number of guests
        </label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Remove guest"
            className="min-h-[44px] min-w-[44px]"
            onClick={handleDecrement}
            disabled={guests <= 1}
          >
            <Minus className="size-4" />
          </Button>
          <Input
            id="booking-guests"
            type="number"
            min={1}
            max={spotsRemaining}
            value={guests}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1 && val <= spotsRemaining) {
                setGuests(val);
              }
            }}
            className="w-20 text-center bg-background border-input text-foreground"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Add guest"
            className="min-h-[44px] min-w-[44px]"
            onClick={handleIncrement}
            disabled={guests >= spotsRemaining}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!isValid || submitting}
        className="w-full h-11"
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Placing booking...
          </span>
        ) : (
          'Confirm Booking'
        )}
      </Button>

      {error && (
        <p role="alert" className="text-sm text-destructive text-center">
          {error}
        </p>
      )}
    </form>
  );
}
