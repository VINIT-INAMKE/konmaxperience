'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from '@/lib/types/shipments';

export type ShipmentStatusFilter = ShipmentStatus | 'all';

interface ShipmentFilterBarProps {
  status: ShipmentStatusFilter;
  onStatusChange: (status: ShipmentStatusFilter) => void;
}

/**
 * The only filter `GET /shipments` offers is `status`, so this is the only
 * filter shown. A search box would have to be faked client-side over one page
 * of results and would quietly lie about what it had searched.
 */
export function ShipmentFilterBar({
  status,
  onStatusChange,
}: ShipmentFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        htmlFor="shipment-status-filter"
        className="text-xs font-medium text-ink-muted"
      >
        Status
      </label>
      <Select
        value={status}
        onValueChange={(value: unknown) =>
          onStatusChange((String(value) || 'all') as ShipmentStatusFilter)
        }
      >
        <SelectTrigger id="shipment-status-filter" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {SHIPMENT_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {SHIPMENT_STATUS_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * `live` is true only once Pusher has confirmed the `private-shipments`
 * subscription. When it is false the screen is still current — it polls on the
 * SPEC §6.4 30 s floor — so the copy says which, and never "offline".
 */
export function LiveIndicator({ live }: { live: boolean }) {
  return (
    <span
      className="flex items-center gap-1.5 text-xs text-ink-muted"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${
          live ? 'bg-[var(--status-good)]' : 'bg-ink-faint'
        }`}
      />
      {live ? 'Live' : 'Refreshing every 30s'}
    </span>
  );
}
