'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MapPin, Plus, X } from 'lucide-react';
import { z } from 'zod';
import type { ReactNode } from 'react';

import { GooglePlacesInput } from '@/components/public/GooglePlacesInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import type { CustomerAddress, CustomerAddressPayload } from '@/lib/types/marketplace';
import { cn } from '@/lib/utils';

/**
 * The saved-address list and the create form (`DESIGN-03`).
 *
 * The backend's address shape is **flat** — one free-text `address`, an optional
 * `landmark` and a six-digit `pincode`. There is no `line1`/`city`/`state`
 * split, so this form does not invent one; a form that collected fields the DTO
 * drops would look thorough and lose the data.
 *
 * `lat`/`lng` are held outside the schema on purpose: they are not typed by
 * anyone, they arrive from `GooglePlacesInput`'s place geometry, and modelling
 * them as optional-nullable form fields buys a resolver generic argument for no
 * behaviour. They ride along in the payload when Places supplied them.
 *
 * The pincode is reported upward on every keystroke (and on every selection)
 * because serviceability is asked **before a quote exists** — that is the whole
 * point of the route P5b Task 2 added. `serviceabilitySlot` is where the answer
 * renders, so the composition stays in `FulfilmentStep` and this component
 * keeps owning only the form.
 */

const LABELS = ['Home', 'Work', 'Other'] as const;

const addressSchema = z.object({
  label: z.enum(LABELS),
  address: z.string().trim().min(5, 'Please enter the full address.'),
  landmark: z.string().trim().optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'A pincode is exactly six digits.'),
});

type AddressFormValues = z.infer<typeof addressSchema>;

export interface AddressStepProps {
  addresses: CustomerAddress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (payload: CustomerAddressPayload) => Promise<CustomerAddress | null>;
  /** The pincode serviceability should currently be asked about. */
  onActivePincodeChange: (pincode: string | null) => void;
  isLoading?: boolean;
  isSaving?: boolean;
  /** The server's message from a failed load or save, verbatim. */
  error?: string | null;
  /** Rendered under the list — the `ServiceabilityNote` for the active pincode. */
  serviceabilitySlot?: ReactNode;
  className?: string;
}

export function AddressStep({
  addresses,
  selectedId,
  onSelect,
  onCreate,
  onActivePincodeChange,
  isLoading = false,
  isSaving = false,
  error = null,
  serviceabilitySlot,
  className,
}: AddressStepProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [geo, setGeo] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { label: 'Home', address: '', landmark: '', pincode: '' },
    mode: 'onBlur',
  });

  const selectedLabel = watch('label');
  const draftPincode = watch('pincode');

  // The list is empty on a first-ever checkout: open the form rather than
  // showing an empty box with a link the customer has to find.
  const openedForEmptyList = useRef(false);
  useEffect(() => {
    if (isLoading || openedForEmptyList.current) return;
    if (addresses.length === 0) {
      openedForEmptyList.current = true;
      setIsCreating(true);
    }
  }, [addresses.length, isLoading]);

  // Whichever pincode the customer is currently expressing an intention about:
  // the one being typed while the form is open, otherwise the selected row's.
  const selected = addresses.find((a) => a.id === selectedId) ?? null;
  const activePincode = isCreating ? (draftPincode ?? '') : (selected?.pincode ?? '');
  useEffect(() => {
    onActivePincodeChange(activePincode.trim() || null);
  }, [activePincode, onActivePincodeChange]);

  const handlePlaceSelect = useCallback(
    (place: { formattedAddress: string; pincode: string; lat: number | null; lng: number | null }) => {
      setValue('address', place.formattedAddress, { shouldValidate: true });
      // Places does not always return a postal_code; leave what is typed rather
      // than blanking a pincode the customer already supplied.
      if (place.pincode) setValue('pincode', place.pincode, { shouldValidate: true });
      setGeo({ lat: place.lat, lng: place.lng });
    },
    [setValue],
  );

  const submit = handleSubmit(async (values) => {
    const payload: CustomerAddressPayload = {
      label: values.label,
      address: values.address.trim(),
      pincode: values.pincode.trim(),
    };
    const landmark = values.landmark?.trim();
    if (landmark) payload.landmark = landmark;
    if (geo.lat !== null) payload.lat = geo.lat;
    if (geo.lng !== null) payload.lng = geo.lng;

    const created = await onCreate(payload);
    if (!created) return; // the error is already rendered from `error`
    onSelect(created.id);
    reset({ label: 'Home', address: '', landmark: '', pincode: '' });
    setGeo({ lat: null, lng: null });
    setIsCreating(false);
  });

  if (isLoading && addresses.length === 0) {
    return <StorefrontSkeleton variant="list" count={2} className={className} />;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {addresses.length > 0 ? (
        <ul className="space-y-2">
          {addresses.map((address) => {
            const isSelected = address.id === selectedId;
            return (
              <li key={address.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                    isSelected
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface hover:border-line-strong hover:bg-surface-raised',
                  )}
                >
                  <input
                    type="radio"
                    name="checkout-delivery-address"
                    value={address.id}
                    checked={isSelected}
                    onChange={() => onSelect(address.id)}
                    className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-brand">
                        {address.label}
                      </span>
                      {address.is_default ? (
                        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-ink-muted">
                          Default
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm text-ink-subtle">{address.address}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {address.landmark ? `${address.landmark} · ` : ''}
                      {address.pincode}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}

      {serviceabilitySlot}

      {isCreating ? (
        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          className="space-y-4 rounded-xl border border-line bg-surface-raised p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink-strong">Add an address</p>
            {addresses.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setIsCreating(false)}
              >
                <X className="size-3.5" aria-hidden="true" />
                Cancel
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Address label">
            {LABELS.map((label) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={selectedLabel === label}
                onClick={() => setValue('label', label, { shouldValidate: true })}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  selectedLabel === label
                    ? 'bg-brand text-brand-ink'
                    : 'border border-line bg-surface text-ink-subtle hover:border-line-strong',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-ink-subtle">Search for your address</Label>
            <GooglePlacesInput onPlaceSelect={handlePlaceSelect} />
            <p className="text-xs text-ink-faint">
              Pick a suggestion to fill the address and pincode, or type them below.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="checkout-address" className="text-ink-subtle">
              Full address
            </Label>
            <Input
              id="checkout-address"
              autoComplete="street-address"
              placeholder="Flat, building, street, area"
              aria-invalid={errors.address ? true : undefined}
              className="h-10"
              {...register('address')}
            />
            {errors.address ? (
              <p role="alert" className="text-xs text-serious">
                {errors.address.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="checkout-landmark" className="text-ink-subtle">
                Landmark <span className="text-ink-faint">(optional)</span>
              </Label>
              <Input
                id="checkout-landmark"
                placeholder="Near the temple"
                className="h-10"
                {...register('landmark')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="checkout-pincode" className="text-ink-subtle">
                Pincode
              </Label>
              <Input
                id="checkout-pincode"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                placeholder="560001"
                aria-invalid={errors.pincode ? true : undefined}
                className="h-10"
                {...register('pincode')}
              />
              {errors.pincode ? (
                <p role="alert" className="text-xs text-serious">
                  {errors.pincode.message}
                </p>
              ) : null}
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-serious">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>
                <MapPin className="size-4" aria-hidden="true" />
                Save and use this address
              </>
            )}
          </Button>
        </form>
      ) : (
        <div className="space-y-2">
          {error ? (
            <p role="alert" className="text-sm text-serious">
              {error}
            </p>
          ) : null}
          <Button type="button" variant="outline" onClick={() => setIsCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add a new address
          </Button>
        </div>
      )}
    </div>
  );
}
