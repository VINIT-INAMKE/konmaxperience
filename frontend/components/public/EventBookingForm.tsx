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
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-base text-gray-500">This event is full</p>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-base text-green-700">
          You&apos;re booked! We&apos;ll see you on {formattedDate}.
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
          `Sorry, this event just filled up. No spots remain for ${guests} guests.`
        );
      } else {
        setError(
          "Couldn't complete your booking \u2014 please check your connection and try again."
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
        <Input
          placeholder="Your name"
          required
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div className="space-y-2">
        <Input
          placeholder="Your phone number"
          required
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-gray-700">Number of guests</label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="min-h-[44px] min-w-[44px] border-gray-300"
            onClick={handleDecrement}
            disabled={guests <= 1}
          >
            <Minus className="size-4" />
          </Button>
          <Input
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
            className="w-20 text-center bg-white border-gray-300 text-gray-900"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="min-h-[44px] min-w-[44px] border-gray-300"
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
            Booking...
          </span>
        ) : (
          'Confirm Booking'
        )}
      </Button>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </form>
  );
}
