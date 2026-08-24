import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, Clock, MapPin, Users } from 'lucide-react';

import { BookingPanel } from '@/components/storefront/experiences/BookingPanel';
import { loadExperience } from '@/components/storefront/experiences/experience-data';
import { formatDateLong, formatTime } from '@/lib/format/date';
import { breadcrumbJsonLd, eventJsonLd, jsonLdScript } from '@/lib/seo/json-ld';
import { metaDescription, storefrontMetadata } from '@/lib/seo/metadata';
import { EVENT_TYPE_LABELS } from '@/lib/types/events';
import { storefrontProductImage } from '@/lib/types/storefront';

/**
 * `/experiences/[slug]` — one sitting (`STORE-01`, `CAT-04`).
 *
 * A **server component** with `generateMetadata` and schema.org `Event` markup.
 * Only {@link BookingPanel} crosses into the client, because only the guest
 * stepper and the live seat count need to.
 *
 * `notFound()` covers everything that must not have a public page: an unknown
 * slug, a product that is not an `experience`, a draft or archived product, an
 * experience with no sitting attached, and a sitting whose `EventStatus` is
 * `draft` or `cancelled`. `loadExperience` folds all six into one `null`.
 *
 * `force-dynamic`: the seat count is live, and `generateMetadata` and the body
 * share one pair of requests through React's `cache`.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const experience = await loadExperience(slug);

  if (!experience) {
    return { title: 'Experience not found — Konma', robots: { index: false, follow: false } };
  }

  const { product, startsAt, venue } = experience;
  const where = venue ? ` at ${venue}` : '';
  const description = metaDescription(
    `${formatDateLong(startsAt)}, ${formatTime(startsAt)}${where}. ${product.description}`,
  );

  return storefrontMetadata({
    title: `${product.name} — Konma`,
    description,
    path: `/experiences/${product.slug}`,
    image: storefrontProductImage(product) ?? experience.event?.image_url ?? null,
    type: 'article',
    // A sitting that has run keeps its page — it still earns search traffic and
    // it is the honest destination for an old link — but it is not offered up
    // as a thing to buy.
    noIndex: !experience.isUpcoming,
  });
}

/** `next/image` needs a host declared in `next.config.ts`; anything else degrades. */
function isRenderableImage(url: string | null): url is string {
  return typeof url === 'string' && url.startsWith('https://');
}

export default async function ExperienceDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const experience = await loadExperience(slug);

  if (!experience) notFound();

  const { product, event, startsAt, capacity, spotsRemaining, venue, eventType, isUpcoming } =
    experience;
  const image = storefrontProductImage(product) ?? event?.image_url ?? null;
  const gallery = (product.media ?? []).filter((m) => m.kind === 'image');

  const jsonLd = [
    eventJsonLd({
      name: product.name,
      slug: product.slug,
      description: product.description,
      startDate: startsAt,
      // `Event` has no end column, so no `endDate` is claimed. An invented one
      // would be structured data that contradicts the page.
      endDate: null,
      price: product.base_price,
      image,
      spotsRemaining,
      locationName: venue ?? undefined,
      locationAddress: event?.brand?.name ?? undefined,
    }),
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Experiences', path: '/experiences' },
      { name: product.name, path: `/experiences/${product.slug}` },
    ]),
  ];

  return (
    <div className="space-y-10">
      {/* `jsonLdScript` escapes `<` so a description can never close this early. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/experiences" className="hover:text-ink-strong">
          Experiences
        </Link>
        <span aria-hidden="true" className="px-2 text-ink-faint">
          /
        </span>
        <span className="text-ink-subtle">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
        <div className="min-w-0 space-y-8">
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-surface-raised">
            {isRenderableImage(image) ? (
              <Image
                src={image}
                alt={gallery[0]?.alt || product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <CalendarDays className="size-10 text-ink-faint" aria-hidden="true" />
              </div>
            )}
          </div>

          {gallery.length > 1 ? (
            <ul className="grid grid-cols-4 gap-3">
              {gallery.slice(1, 5).map((media) => (
                <li
                  key={media.id}
                  className="relative aspect-square overflow-hidden rounded-xl bg-surface-raised"
                >
                  {isRenderableImage(media.url) ? (
                    <Image
                      src={media.url}
                      alt={media.alt || ''}
                      fill
                      sizes="12rem"
                      className="object-cover"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-4">
            {eventType ? (
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                {EVENT_TYPE_LABELS[eventType]}
              </p>
            ) : null}
            <h1 className="text-3xl font-semibold tracking-tight text-ink-strong">
              {product.name}
            </h1>

            <dl className="grid gap-3 rounded-xl border border-line-warm bg-surface/60 p-4 sm:grid-cols-3">
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-xs text-ink-faint">Date</dt>
                  <dd className="text-sm text-ink-strong">{formatDateLong(startsAt)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-xs text-ink-faint">Time</dt>
                  <dd className="text-sm text-ink-strong">{formatTime(startsAt)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                {venue ? (
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                ) : (
                  <Users className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <dt className="text-xs text-ink-faint">{venue ? 'Venue' : 'Sitting'}</dt>
                  <dd className="text-sm text-ink-strong">
                    {venue ?? `${capacity} places`}
                  </dd>
                </div>
              </div>
            </dl>

            <p className="max-w-prose text-base leading-relaxed text-ink-subtle">
              {product.description}
            </p>

            {product.story ? (
              <p className="max-w-prose text-base leading-relaxed text-ink-muted">
                {product.story}
              </p>
            ) : null}

            {event?.description && event.description !== product.description ? (
              <p className="max-w-prose text-base leading-relaxed text-ink-muted">
                {event.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <BookingPanel
            product={product}
            eventId={event?.id ?? product.event?.id ?? ''}
            initialEvent={event}
            isUpcoming={isUpcoming}
            fallbackCapacity={capacity}
          />
        </div>
      </div>
    </div>
  );
}
