'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import type { Event, EventType } from '@/lib/types/events';
import { EVENT_TYPE_LABELS } from '@/lib/types/events';
import type { Zone } from '@/lib/types/zone';
import type { Brand } from '@/lib/types/brand';

const EVENT_TYPES: EventType[] = ['dining', 'workshop', 'pop_up', 'tasting', 'other'];

const eventFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  event_type: z.string().min(1, 'Event type is required'),
  date: z.string().min(1, 'Date is required'),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  price: z.number().min(0, 'Price must be 0 or more'),
  zone_id: z.string().optional(),
  brand_id: z.string().optional(),
  description: z.string().max(2000).optional(),
  image_url: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface EventFormProps {
  event?: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EventForm({ event, open, onOpenChange, onSaved }: EventFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!event;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      event_type: '',
      date: '',
      capacity: 1,
      price: 0,
      zone_id: '',
      brand_id: '',
      description: '',
      image_url: '',
    },
  });

  const eventTypeValue = watch('event_type');
  const zoneIdValue = watch('zone_id');
  const brandIdValue = watch('brand_id');

  // Populate form when editing
  useEffect(() => {
    if (event && open) {
      reset({
        title: event.title,
        event_type: event.event_type,
        date: event.date ? event.date.slice(0, 16) : '',
        capacity: event.capacity,
        price: event.price,
        zone_id: event.zone_id ?? '',
        brand_id: event.brand_id ?? '',
        description: event.description ?? '',
        image_url: event.image_url ?? '',
      });
    } else if (!event && open) {
      reset({
        title: '',
        event_type: '',
        date: '',
        capacity: 1,
        price: 0,
        zone_id: '',
        brand_id: '',
        description: '',
        image_url: '',
      });
    }
  }, [event, open, reset]);

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
    enabled: open,
  });

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: () => apiClient.get<Brand[]>('/brands'),
    enabled: open,
  });

  const onSubmit = async (data: EventFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        zone_id: data.zone_id || undefined,
        brand_id: data.brand_id || undefined,
        description: data.description || undefined,
        image_url: data.image_url || undefined,
      };

      if (isEditing && event) {
        await apiClient.patch(`/events/${event.id}`, payload);
        toast.success('Event updated.');
      } else {
        await apiClient.post('/events', payload);
        toast.success('Event created.');
      }
      void queryClient.invalidateQueries({ queryKey: ['ops-events'] });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Event' : 'Create Event'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4 mt-4 px-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              placeholder="e.g. Sunset Dinner Experience"
              {...register('title')}
              disabled={isSubmitting}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label>Event Type</Label>
            <Select
              value={eventTypeValue}
              onValueChange={(v) => setValue('event_type', v ?? '')}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {EVENT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.event_type && (
              <p className="text-xs text-destructive">{errors.event_type.message}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="event-date">Date &amp; Time</Label>
            <Input
              id="event-date"
              type="datetime-local"
              {...register('date')}
              disabled={isSubmitting}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date.message}</p>
            )}
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <Label htmlFor="event-capacity">Capacity</Label>
            <Input
              id="event-capacity"
              type="number"
              min={1}
              {...register('capacity', { valueAsNumber: true })}
              disabled={isSubmitting}
            />
            {errors.capacity && (
              <p className="text-xs text-destructive">{errors.capacity.message}</p>
            )}
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="event-price">Price</Label>
            <Input
              id="event-price"
              type="number"
              min={0}
              step={0.01}
              {...register('price', { valueAsNumber: true })}
              disabled={isSubmitting}
            />
            {errors.price && (
              <p className="text-xs text-destructive">{errors.price.message}</p>
            )}
          </div>

          {/* Zone */}
          <div className="space-y-2">
            <Label>Zone (optional)</Label>
            <Select
              value={zoneIdValue}
              onValueChange={(v) => setValue('zone_id', v ?? '')}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {zones?.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Brand */}
          <div className="space-y-2">
            <Label>Brand (optional)</Label>
            <Select
              value={brandIdValue}
              onValueChange={(v) => setValue('brand_id', v ?? '')}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {brands?.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="event-description">Description (optional)</Label>
            <Textarea
              id="event-description"
              placeholder="Describe the event..."
              {...register('description')}
              disabled={isSubmitting}
              style={{ minHeight: '80px' }}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="event-image">Image URL (optional)</Label>
            <Input
              id="event-image"
              placeholder="https://..."
              {...register('image_url')}
              disabled={isSubmitting}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Saving...
                </span>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Event'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
