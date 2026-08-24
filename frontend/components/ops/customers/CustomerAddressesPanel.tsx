'use client';

/**
 * The customer's saved delivery addresses (`GET /customers/:id` → `addresses`).
 *
 * Read-only on purpose. `POST/PATCH/DELETE /customer/addresses` sit behind
 * `CustomerGuard` — they are the customer's own to edit from `/account`, and
 * the staff `MANAGE_OPS` surface has no write for them. Staff need these to
 * answer "where is this going?", not to change it.
 *
 * The list arrives ordered `is_default desc, created_at desc`, so the default
 * address is always first; the badge says so rather than relying on position.
 */

import { Home, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import { formatDate } from '@/lib/format/date';
import type { CustomerAddress } from '@/lib/types/marketplace';
import { PanelEmpty, PanelHeading } from '@/components/ops/customers/CustomerPanel';

interface CustomerAddressesPanelProps {
  addresses: CustomerAddress[];
}

export function CustomerAddressesPanel({ addresses }: CustomerAddressesPanelProps) {
  if (addresses.length === 0) {
    return (
      <PanelEmpty
        icon={MapPin}
        title="No saved addresses"
        description="Addresses are saved by the customer at checkout. Dine-in, takeaway and pickup orders never create one."
      />
    );
  }

  return (
    <div className="space-y-3">
      <PanelHeading
        title={`${addresses.length} saved ${addresses.length === 1 ? 'address' : 'addresses'}`}
        hint="Read-only — a customer edits these from their own account."
      />

      <ul className="grid gap-3 sm:grid-cols-2">
        {addresses.map((address) => (
          <li key={address.id} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Home className="size-4 text-muted-foreground" aria-hidden />
                <span className="text-sm font-medium">{address.label}</span>
              </div>
              {address.is_default && (
                <Badge variant="outline" className={STATUS_BADGE.info}>
                  Default
                </Badge>
              )}
            </div>
            <p className="mt-2 text-sm whitespace-pre-line">{address.address}</p>
            {address.landmark && (
              <p className="mt-1 text-sm text-muted-foreground">
                Landmark: {address.landmark}
              </p>
            )}
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              PIN {address.pincode}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Saved {formatDate(address.created_at)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
