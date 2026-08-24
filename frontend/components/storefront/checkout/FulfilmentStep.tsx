'use client';

import { ArrowLeft, Loader2, Package, Ticket } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AddressStep } from '@/components/storefront/checkout/AddressStep';
import { PickupToggle } from '@/components/storefront/checkout/PickupToggle';
import { ServiceabilityNote } from '@/components/storefront/checkout/ServiceabilityNote';
import type { CheckoutChannel, ServiceabilityResponse } from '@/lib/types/checkout';
import type { CustomerAddress, CustomerAddressPayload } from '@/lib/types/marketplace';
import { cn } from '@/lib/utils';

/**
 * Step 2 — where everything goes, and whether we can actually get it there.
 *
 * The composition is driven by what is genuinely in the cart, because the three
 * fulfilment types ask different questions:
 *
 * | in the cart | asks |
 * |---|---|
 * | `local` | deliver or collect (`PickupToggle`), and an address unless collecting |
 * | `shipped` | an address, **always** — `checkout.service.ts:161` throws without one |
 * | `booking` | nothing; an experience is attended, not delivered |
 *
 * So `addressRequired = hasShipped || (hasLocal && !pickup)`, and a
 * booking-only cart walks straight through with no address prompt at all.
 *
 * "Continue to review" is the gate on the whole money path: past it a quote is
 * issued, a price freezes, bookings go on 15-minute hold and the clock starts.
 * Everything blocking is therefore resolved *here* — which is exactly why
 * serviceability is asked before a quote exists rather than discovered as a
 * `400` two steps later.
 */

export interface FulfilmentStepProps {
  hasLocal: boolean;
  hasShipped: boolean;
  hasBooking: boolean;

  pickup: boolean;
  onFulfilmentChange: (next: { pickup: boolean; channel: CheckoutChannel }) => void;

  addresses: CustomerAddress[];
  selectedAddressId: string | null;
  onSelectAddress: (id: string) => void;
  onCreateAddress: (payload: CustomerAddressPayload) => Promise<CustomerAddress | null>;
  onActivePincodeChange: (pincode: string | null) => void;
  isLoadingAddresses?: boolean;
  isSavingAddress?: boolean;
  addressError?: string | null;

  serviceability: ServiceabilityResponse | null;
  isCheckingServiceability?: boolean;
  serviceabilityError?: string | null;

  onBack: () => void;
  onContinue: () => void;
  /** `true` while the cart is being pushed to Redis ahead of the first quote. */
  isContinuing?: boolean;
  className?: string;
}

export function FulfilmentStep({
  hasLocal,
  hasShipped,
  hasBooking,
  pickup,
  onFulfilmentChange,
  addresses,
  selectedAddressId,
  onSelectAddress,
  onCreateAddress,
  onActivePincodeChange,
  isLoadingAddresses = false,
  isSavingAddress = false,
  addressError = null,
  serviceability,
  isCheckingServiceability = false,
  serviceabilityError = null,
  onBack,
  onContinue,
  isContinuing = false,
  className,
}: FulfilmentStepProps) {
  const addressRequired = hasShipped || (hasLocal && !pickup);

  // Local delivery being refused only blocks a cart that is actually asking for
  // local delivery; with `pickup` on, the allow-list is skipped server-side.
  const localBlocked =
    hasLocal && !pickup && serviceability?.local.serviceable === false;
  // `shipped: null` means "this cart ships nothing" — never "unserviceable".
  const shippedBlocked =
    hasShipped && serviceability?.shipped !== null && serviceability?.shipped?.serviceable === false;

  const missingAddress = addressRequired && !selectedAddressId;
  const canContinue = !missingAddress && !localBlocked && !shippedBlocked;

  const blockedReason = missingAddress
    ? hasShipped && !hasLocal
      ? 'Choose or add an address — your parcel needs somewhere to go.'
      : 'Choose or add a delivery address, or switch to collecting at the villa.'
    : localBlocked
      ? 'We do not deliver to this pincode. Collect at the villa, or pick another address.'
      : shippedBlocked
        ? 'No courier serves this pincode. Pick another address to continue.'
        : null;

  return (
    <section
      aria-labelledby="checkout-fulfilment-heading"
      className={cn('rounded-2xl border border-line bg-surface p-5 sm:p-6', className)}
    >
      <h2 id="checkout-fulfilment-heading" className="text-base font-semibold text-ink-strong">
        Fulfilment
      </h2>

      <div className="mt-5 space-y-6">
        {hasLocal ? (
          <PickupToggle pickup={pickup} onChange={onFulfilmentChange} />
        ) : null}

        {hasShipped ? (
          <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink-subtle">
            <Package className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
            Your shipped items go by courier and always need a delivery address.
          </p>
        ) : null}

        {hasBooking ? (
          <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink-subtle">
            <Ticket className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
            Your experiences are attended at the villa — nothing to deliver.
          </p>
        ) : null}

        {addressRequired ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-ink-strong">Delivery address</h3>
            <AddressStep
              addresses={addresses}
              selectedId={selectedAddressId}
              onSelect={onSelectAddress}
              onCreate={onCreateAddress}
              onActivePincodeChange={onActivePincodeChange}
              isLoading={isLoadingAddresses}
              isSaving={isSavingAddress}
              error={addressError}
              serviceabilitySlot={
                <ServiceabilityNote
                  result={serviceability}
                  isLoading={isCheckingServiceability}
                  error={serviceabilityError}
                  showLocal={hasLocal && !pickup}
                  onOfferPickup={
                    hasLocal ? () => onFulfilmentChange({ pickup: true, channel: 'takeaway' }) : undefined
                  }
                />
              }
            />
          </div>
        ) : null}
      </div>

      {blockedReason ? (
        <p role="status" className="mt-5 text-sm text-ink-muted">
          {blockedReason}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={onContinue}
          disabled={!canContinue || isContinuing}
        >
          {isContinuing ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Pricing your order…
            </>
          ) : (
            'Continue to review'
          )}
        </Button>
      </div>
    </section>
  );
}
