import { CalendarDays, ChefHat, PackageSearch } from 'lucide-react';
import type { ReactNode } from 'react';

import { formatDateTime } from '@/lib/format/date';
import { cn } from '@/lib/utils';

import { TimelineRail } from './TimelineRail';
import {
  buildBookingSteps,
  buildLocalSteps,
  isDeliveryOrder,
  type TrackOrder,
  type TrackOrderItem,
} from './track-model';

/**
 * The non-parcel halves of a mixed order: the kitchen rail and one rail per
 * booked seat. The parcel is `ShipmentTracker`'s job, because it is driven by a
 * different table (`Shipment` + `ShipmentEvent`) on a different update path
 * (courier webhooks), and pretending otherwise is exactly how a mixed order
 * ends up with one meaningless progress bar.
 *
 * A booking gets its **own** rail per line rather than a merged one: two
 * different experiences on one order are two different evenings, and staff mark
 * attendance per booking through `POST /events/:id/attendance`.
 */

function GroupCard({
  icon,
  title,
  subtitle,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-line bg-surface', className)}>
      <header className="border-b border-line-warm p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-strong">
          {icon}
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ItemLines({ items }: { items: readonly TrackOrderItem[] }) {
  return (
    <ul className="mt-5 space-y-0.5 border-t border-line-warm pt-4 text-sm text-ink-subtle">
      {items.map((item) => (
        <li key={item.id} className="flex items-baseline justify-between gap-4">
          <span className="min-w-0 truncate">{item.product.name}</span>
          <span className="shrink-0 text-ink-muted tabular-nums">&times;{item.quantity}</span>
        </li>
      ))}
    </ul>
  );
}

export interface LocalGroupProps {
  order: TrackOrder;
  items: readonly TrackOrderItem[];
  className?: string;
}

/** `placed -> confirmed -> preparing -> ready -> served/dispatched -> delivered`. */
export function LocalGroup({ order, items, className }: LocalGroupProps) {
  const delivery = isDeliveryOrder(order);

  return (
    <GroupCard
      className={className}
      icon={<ChefHat className="size-4 text-ink-muted" aria-hidden="true" />}
      title="From the kitchen"
      subtitle={
        delivery
          ? 'Prepared at the villa and driven to your address.'
          : 'Prepared at the villa for collection.'
      }
    >
      <TimelineRail steps={buildLocalSteps(order, items)} />
      <ItemLines items={items} />
    </GroupCard>
  );
}

export interface BookingGroupProps {
  order: TrackOrder;
  items: readonly TrackOrderItem[];
  className?: string;
}

/** One `held -> confirmed -> attended` rail per seat. */
export function BookingGroup({ order, items, className }: BookingGroupProps) {
  return (
    <GroupCard
      className={className}
      icon={<CalendarDays className="size-4 text-ink-muted" aria-hidden="true" />}
      title="Your experience"
      subtitle="Your seat is held from the moment you pay and confirmed on the guest list."
    >
      <div className="space-y-8">
        {items.map((item) => (
          <div key={item.id}>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm font-medium text-ink-strong">{item.product.name}</p>
              <p className="text-sm text-ink-muted tabular-nums">
                {item.quantity} {item.quantity === 1 ? 'guest' : 'guests'}
              </p>
            </div>
            {item.product.event?.date ? (
              <p className="mb-4 text-sm text-ink-subtle">
                {formatDateTime(item.product.event.date)}
              </p>
            ) : null}
            <TimelineRail steps={buildBookingSteps(order, item)} />
          </div>
        ))}
      </div>
    </GroupCard>
  );
}

export interface PendingShipmentGroupProps {
  items: readonly TrackOrderItem[];
  className?: string;
}

/**
 * The honest state for shipped lines with **no `Shipment` row yet**.
 *
 * `GET /customer/orders/:id/shipment` returns `null` both for an order that
 * ships nothing and for one nobody has packed — the caller knows which, and
 * this is the second case. Payment confirm sets shipped lines to `packed`
 * before a human has touched a box (P5b decision 10), so the copy deliberately
 * does not claim the parcel is packed.
 */
export function PendingShipmentGroup({ items, className }: PendingShipmentGroupProps) {
  return (
    <GroupCard
      className={className}
      icon={<PackageSearch className="size-4 text-ink-muted" aria-hidden="true" />}
      title="Shipped to you"
      subtitle="We are getting this parcel ready. Tracking appears here as soon as a courier is booked."
    >
      <ItemLines items={items} />
    </GroupCard>
  );
}

export interface OrderTimelineProps {
  order: TrackOrder;
  local: readonly TrackOrderItem[];
  booking: readonly TrackOrderItem[];
  className?: string;
}

/** Convenience wrapper for the two non-parcel groups, in presentation order. */
export function OrderTimeline({ order, local, booking, className }: OrderTimelineProps) {
  return (
    <div data-slot="order-timeline" className={cn('space-y-6', className)}>
      {local.length ? <LocalGroup order={order} items={local} /> : null}
      {booking.length ? <BookingGroup order={order} items={booking} /> : null}
    </div>
  );
}
