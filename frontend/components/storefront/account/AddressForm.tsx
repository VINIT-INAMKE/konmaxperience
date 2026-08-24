'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

import { GooglePlacesInput } from '@/components/public/GooglePlacesInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CustomerAddress, CustomerAddressPayload } from '@/lib/types/marketplace';

/**
 * `label` is a closed set on the server (`CreateAddressDto`), so it is a radio
 * group here rather than a free-text field that would only ever produce a 400.
 * `pincode` is six digits: the serviceability check at checkout keys on it, and
 * a five-digit typo fails there with a message about delivery rather than about
 * the address, which is the wrong place to learn it.
 */
const addressSchema = z.object({
  label: z.enum(['Home', 'Work', 'Other']),
  address: z
    .string()
    .trim()
    .min(10, 'Give us enough of the address for a rider to find it')
    .max(500, 'That is longer than we can store'),
  landmark: z.string().trim().max(200, 'Keep the landmark short').optional(),
  pincode: z.string().regex(/^\d{6}$/, 'A pincode is six digits'),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

const LABELS: AddressFormValues['label'][] = ['Home', 'Work', 'Other'];

/**
 * Create or edit one saved address.
 *
 * **The Places lookup fills the form; it does not replace it.** Autocomplete
 * gives a formatted address and, usually, a pincode and coordinates — but it
 * routinely misses a flat number and occasionally misses the pincode entirely,
 * so every field stays editable afterwards and `pincode` is validated on its
 * own. `lat`/`lng` are carried through untouched when they exist because
 * delivery serviceability uses them; they are simply absent when the customer
 * typed the address by hand, which the API allows.
 */
export interface AddressFormProps {
  /** Present when editing. The Places lookup is still offered. */
  initial?: CustomerAddress;
  submitLabel: string;
  onSubmit: (payload: CustomerAddressPayload) => Promise<void>;
  onCancel: () => void;
}

export function AddressForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: AddressFormProps) {
  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: initial?.label ?? 'Home',
      address: initial?.address ?? '',
      landmark: initial?.landmark ?? '',
      pincode: initial?.pincode ?? '',
      lat: initial?.lat ?? null,
      lng: initial?.lng ?? null,
    },
  });

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  // `useWatch` rather than `watch()`: the latter returns a fresh function on
  // every render, which opts the whole component out of React Compiler
  // memoisation (`react-hooks/incompatible-library`). `useWatch` subscribes to
  // the one field the radio group needs and re-renders only on its change.
  const selectedLabel = useWatch({ control, name: 'label' });

  const submit = handleSubmit(async (values) => {
    const payload: CustomerAddressPayload = {
      label: values.label,
      address: values.address,
      pincode: values.pincode,
    };
    if (values.landmark) payload.landmark = values.landmark;
    if (values.lat !== null) payload.lat = values.lat;
    if (values.lng !== null) payload.lng = values.lng;
    await onSubmit(payload);
  });

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-4 rounded-xl border border-line bg-surface p-5"
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-strong">Label</legend>
        <div className="flex flex-wrap gap-2">
          {LABELS.map((option) => (
            <label
              key={option}
              className={
                selectedLabel === option
                  ? 'cursor-pointer rounded-full border border-brand bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand'
                  : 'cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-line-strong hover:text-ink-strong'
              }
            >
              <input
                type="radio"
                value={option}
                className="sr-only"
                {...register('label')}
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        {/*
          Not a <Label>: `GooglePlacesInput` renders the Places widget's own
          input and takes no `id`, so a `htmlFor` here would point at nothing
          and a screen reader would announce an orphaned label.
        */}
        <p className="text-sm font-medium text-ink-strong">Find your address</p>
        <GooglePlacesInput
          placeholder="Start typing your street or building..."
          onPlaceSelect={(place) => {
            setValue('address', place.formattedAddress, { shouldValidate: true });
            if (place.pincode) {
              setValue('pincode', place.pincode, { shouldValidate: true });
            }
            setValue('lat', place.lat);
            setValue('lng', place.lng);
          }}
        />
        <p className="text-xs text-ink-faint">
          Optional — the lookup fills the fields below, and you can correct anything
          it gets wrong.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address-line">Address</Label>
        <Input
          id="address-line"
          autoComplete="street-address"
          placeholder="Flat, building, street, area"
          aria-invalid={errors.address ? true : undefined}
          {...register('address')}
        />
        {errors.address ? (
          <p role="alert" className="text-xs text-[var(--status-serious)]">
            {errors.address.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="address-landmark">
            Landmark <span className="text-ink-faint">(optional)</span>
          </Label>
          <Input
            id="address-landmark"
            placeholder="Opposite the temple"
            aria-invalid={errors.landmark ? true : undefined}
            {...register('landmark')}
          />
          {errors.landmark ? (
            <p role="alert" className="text-xs text-[var(--status-serious)]">
              {errors.landmark.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address-pincode">Pincode</Label>
          <Input
            id="address-pincode"
            inputMode="numeric"
            maxLength={6}
            autoComplete="postal-code"
            placeholder="560001"
            aria-invalid={errors.pincode ? true : undefined}
            {...register('pincode')}
          />
          {errors.pincode ? (
            <p role="alert" className="text-xs text-[var(--status-serious)]">
              {errors.pincode.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {submitLabel}
        </Button>
        <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
