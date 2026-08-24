import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, Clock, MapPin } from 'lucide-react';

import { PriceTag } from '@/components/storefront/common/PriceTag';
import { formatDateLong, formatTime } from '@/lib/format/date';
import { EVENT_TYPE_LABELS } from '@/lib/types/events';
import { storefrontProductImage } from '@/lib/types/storefront';
import { cn } from '@/lib/utils';

import { CapacityNote, isSoldOut } from './CapacityNote';
import type { Experience } from './experience-data';

/**
 * One sitting in the `/experiences` list: what it is, when and where it runs,
 * what a place costs, and how many are left.
 *
 * ## The price is the **product's**, not the event's
 *
 * `Event.price` and `Product.base_price` are two columns and the storefront must
 * render the second one. The cart, the quote and the order all price a booking
 * line from `Product.base_price` (`customer-orders.service.ts` re-derives it on
 * every sync, `CHK-01`), so showing `Event.price` would put a number on the card
 * that the cart then quietly disagrees with. Both are tax-inclusive
 * (P5a decision 1).
 *
 * ## A past sitting is a link, not a dead card
 *
 * The archive exists because an experience page keeps earning search traffic
 * after the date passes. The card dims and drops its seat count; the detail page
 * it points at explains that the sitting has finished.
 */

/** `next/image` needs a host declared in `next.config.ts`; anything else degrades to the placeholder. */
function isRenderableImage(url: string | null): url is string {
  return typeof url === 'string' && url.startsWith('https://');
}

export interface ExperienceCardProps {
  experience: Experience;
  /** Hints the first row of cards at a larger size so LCP is not a 40 px thumbnail. */
  priority?: boolean;
  className?: string;
}

export function ExperienceCard({ experience, priority = false, className }: ExperienceCardProps) {
  const { product, startsAt, capacity, spotsRemaining, venue, eventType, isUpcoming } = experience;
  const image = storefrontProductImage(product) ?? experience.event?.image_url ?? null;
  const soldOut = isUpcoming && isSoldOut(spotsRemaining);

  return (
    <article
      data-slot="experience-card"
      data-sold-out={soldOut || undefined}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow',
        'hover:shadow-lg focus-within:shadow-lg',
        !isUpcoming && 'opacity-75',
        className,
      )}
    >
      <div className="relative aspect-4/3 w-full overflow-hidden bg-surface-raised">
        {isRenderableImage(image) ? (
          <Image
            src={image}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CalendarDays className="size-8 text-ink-faint" aria-hidden="true" />
          </div>
        )}

        {eventType || !isUpcoming ? (
          <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-medium text-ink-subtle backdrop-blur-sm">
            {isUpcoming && eventType ? EVENT_TYPE_LABELS[eventType] : 'Past sitting'}
          </span>
        ) : null}

        {soldOut ? (
          <span className="absolute right-3 top-3 rounded-full bg-ink-strong/85 px-2.5 py-1 text-xs font-semibold text-bg backdrop-blur-sm">
            Sold out
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-lg font-semibold leading-snug text-ink-strong">
          <Link
            href={`/experiences/${product.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
          >
            {product.name}
          </Link>
        </h3>

        <dl className="space-y-1.5 text-sm text-ink-muted">
          <div className="flex items-start gap-2">
            <dt className="sr-only">Date</dt>
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
            <dd>{formatDateLong(startsAt)}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="sr-only">Time</dt>
            <Clock className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
            <dd>{formatTime(startsAt)}</dd>
          </div>
          {venue ? (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Venue</dt>
              <MapPin className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
              <dd>{venue}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-2 pt-1">
          <PriceTag basePrice={product.base_price} size="md" />
          {isUpcoming ? (
            <CapacityNote spotsRemaining={spotsRemaining} capacity={capacity} size="sm" />
          ) : null}
        </div>
      </div>
    </article>
  );
}
