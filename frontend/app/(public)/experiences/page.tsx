import type { Metadata } from 'next';
import { CalendarDays } from 'lucide-react';

import { StorefrontEmpty } from '@/components/storefront/common/StorefrontEmpty';
import { StorefrontError } from '@/components/storefront/common/StorefrontError';
import { ExperienceGrid } from '@/components/storefront/experiences/ExperienceGrid';
import { loadExperiences } from '@/components/storefront/experiences/experience-data';
import { breadcrumbJsonLd, jsonLdScript } from '@/lib/seo/json-ld';
import { storefrontMetadata } from '@/lib/seo/metadata';

/**
 * `/experiences` — every published sitting, upcoming first (`STORE-01`, `CAT-04`).
 *
 * A **server component**: the list is public, it is indexable, and rendering it
 * on the server is what puts the dates, venues and prices into the HTML a
 * crawler reads. The only client code on this route is the booking panel on the
 * detail page.
 *
 * `force-dynamic` because the seat counts are live and because a build machine
 * has no backend — prerendering would bake an empty list into the deployment.
 * See `experience-data.ts` for the whole freshness argument.
 */
export const dynamic = 'force-dynamic';

const TITLE = 'Experiences — Konma';
const DESCRIPTION =
  'Chef’s table dinners, workshops and tastings at the villa. Book a place, pay at checkout.';

export function generateMetadata(): Metadata {
  return storefrontMetadata({
    title: TITLE,
    description: DESCRIPTION,
    path: '/experiences',
  });
}

export default async function ExperiencesPage() {
  const { upcoming, past, failed } = await loadExperiences();

  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Experiences', path: '/experiences' },
  ]);

  return (
    <div className="space-y-10">
      {/* JSON-LD has no other insertion point in the App Router; `jsonLdScript`
          escapes `<` so a description can never close this tag early. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbs) }}
      />

      <header className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-strong">Experiences</h1>
        <p className="text-base text-ink-muted">
          Dinners, workshops and tastings run at the villa on a fixed date, for a fixed number
          of people. Places go into your cart and are held for fifteen minutes once you reach
          checkout.
        </p>
      </header>

      {failed ? (
        <StorefrontError
          title="We could not load the experiences"
          description="The listing is briefly unavailable. Nothing you did caused it."
          href="/shop"
          actionLabel="Browse the shop"
        />
      ) : null}

      {!failed && upcoming.length === 0 && past.length === 0 ? (
        <StorefrontEmpty
          title="No experiences on sale just now"
          description="We run dinners, workshops and tastings through the season. Check back soon, or browse the shop in the meantime."
          icon={CalendarDays}
          action={{ label: 'Browse the shop', href: '/shop' }}
        />
      ) : null}

      <ExperienceGrid
        experiences={upcoming}
        title="Upcoming"
        description="Every sitting still open, soonest first."
      />

      {!failed && upcoming.length === 0 && past.length > 0 ? (
        <StorefrontEmpty
          title="Nothing on sale right now"
          description="The next season is being planned. Below is what we have run recently."
          icon={CalendarDays}
          density="inline"
          action={{ label: 'Browse the shop', href: '/shop' }}
        />
      ) : null}

      <ExperienceGrid
        experiences={past}
        title="Past sittings"
        description="These have already run. They are here because we usually run them again."
        deferImages
      />
    </div>
  );
}
