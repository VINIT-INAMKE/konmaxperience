'use client';

import type { CustomerAddress } from '@/lib/types/marketplace';

interface CustomerAddressCardProps {
  address: CustomerAddress;
  onSetDefault: (id: string) => void;
  onEdit: (address: CustomerAddress) => void;
  onDelete: (id: string) => void;
}

/** Address labels carry no status meaning — these are neutral/brand tints, not the status ramp. */
const LABEL_FALLBACK = 'bg-[var(--public-border-light)] text-[var(--public-fg-subtle)]';

const LABEL_COLORS: Record<string, string> = {
  Home: 'bg-[var(--status-info)]/12 text-[var(--status-info)]',
  Work: 'bg-[var(--public-accent)]/12 text-[var(--public-accent)]',
  Other: LABEL_FALLBACK,
};

export function CustomerAddressCard({
  address,
  onSetDefault,
  onEdit,
  onDelete,
}: CustomerAddressCardProps) {
  const labelClass = LABEL_COLORS[address.label] ?? LABEL_FALLBACK;

  return (
    <div className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 space-y-2">
      {/* Header: label badge + default badge */}
      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${labelClass}`}
        >
          {address.label}
        </span>
        {address.is_default && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--status-good)]/12 text-[var(--status-good)] font-medium">
            Default
          </span>
        )}
      </div>

      {/* Address text */}
      <p className="text-sm text-[var(--public-fg-subtle)]">
        {address.address}
      </p>

      {/* Landmark */}
      {address.landmark && (
        <p className="text-xs text-[var(--public-muted)]">
          Near {address.landmark}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        {!address.is_default && (
          <button
            type="button"
            onClick={() => onSetDefault(address.id)}
            className="text-xs text-[var(--public-terracotta)] hover:underline"
          >
            Set default
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(address)}
          className="text-xs text-[var(--public-terracotta)] hover:underline"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(address.id)}
          className="text-xs text-[var(--destructive)] hover:underline"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
