'use client';

import { useState } from 'react';
import { GooglePlacesInput } from '@/components/public/GooglePlacesInput';
import type { CustomerAddress } from '@/lib/types/marketplace';

interface CreateAddressPayload {
  label: 'Home' | 'Work' | 'Other';
  address: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
}

interface AddressSelectorProps {
  addresses: CustomerAddress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddNew: (address: CreateAddressPayload) => void;
  serviceabilityError?: string;
}

export function AddressSelector({
  addresses,
  selectedId,
  onSelect,
  onAddNew,
  serviceabilityError,
}: AddressSelectorProps) {
  const [showNewForm, setShowNewForm] = useState(addresses.length === 0);
  const [selectedLabel, setSelectedLabel] = useState<'Home' | 'Work' | 'Other'>('Home');

  const handlePlaceSelect = (result: {
    formattedAddress: string;
    pincode: string;
    lat: number | null;
    lng: number | null;
  }) => {
    onAddNew({
      label: selectedLabel,
      address: result.formattedAddress,
      pincode: result.pincode,
      lat: result.lat,
      lng: result.lng,
    });
    setShowNewForm(false);
  };

  return (
    <div className="space-y-3">
      {/* Saved addresses */}
      {addresses.length > 0 && !showNewForm && (
        <div className="space-y-2">
          {addresses.map((addr) => (
            <label
              key={addr.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedId === addr.id
                  ? 'border-[var(--public-terracotta)] bg-[var(--public-surface)]'
                  : 'border-[var(--public-border)] bg-white'
              }`}
            >
              <input
                type="radio"
                name="delivery-address"
                checked={selectedId === addr.id}
                onChange={() => onSelect(addr.id)}
                className="mt-1 accent-[var(--public-terracotta)]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--public-terracotta)]">
                    {addr.label}
                  </span>
                  {addr.is_default && (
                    <span className="text-xs text-[var(--public-muted)] bg-[var(--public-surface)] px-1.5 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--public-fg-subtle)] truncate">
                  {addr.address}
                </p>
              </div>
            </label>
          ))}
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="text-sm text-[var(--public-terracotta)] underline cursor-pointer"
          >
            + Add new address
          </button>
        </div>
      )}

      {/* New address form */}
      {showNewForm && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['Home', 'Work', 'Other'] as const).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setSelectedLabel(label)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                  selectedLabel === label
                    ? 'bg-[var(--public-terracotta)] text-white'
                    : 'bg-[var(--public-surface)] text-[var(--public-fg-subtle)] border border-[var(--public-border)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <GooglePlacesInput onPlaceSelect={handlePlaceSelect} />
          {addresses.length > 0 && (
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="text-sm text-[var(--public-muted)] hover:text-[var(--public-terracotta)] cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Serviceability error */}
      {serviceabilityError && (
        <div className="rounded-lg border border-[var(--status-warning)]/25 bg-[var(--status-warning)]/10 px-4 py-3 text-sm text-[var(--status-warning)]">
          {serviceabilityError}
        </div>
      )}
    </div>
  );
}
