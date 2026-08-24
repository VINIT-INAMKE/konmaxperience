import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { ExperienceCard } from './ExperienceCard';
import type { Experience } from './experience-data';

/**
 * One titled group of {@link ExperienceCard}s — "Upcoming" and "Past sittings"
 * on `/experiences`.
 *
 * A server component with no state of its own: the page decides what belongs in
 * each group (`experience-data.ts`), and the grid only lays it out. It renders
 * **nothing at all** when its group is empty rather than an inline empty state,
 * because the page needs one empty message for "no experiences anywhere", not
 * one per group — `StorefrontEmpty` says that better, once.
 *
 * The first two cards get `priority` so the largest contentful paint is a real
 * image rather than a lazily-fetched one.
 */

/** How many cards are eagerly loaded — one desktop row's worth of the fold. */
const PRIORITY_CARDS = 2;

export interface ExperienceGridProps {
  experiences: Experience[];
  title: string;
  /** A quiet line under the heading — "Book a place, pay at checkout." */
  description?: ReactNode;
  /** Suppresses `priority` on the first cards, for a group below the fold. */
  deferImages?: boolean;
  className?: string;
}

export function ExperienceGrid({
  experiences,
  title,
  description,
  deferImages = false,
  className,
}: ExperienceGridProps) {
  if (experiences.length === 0) return null;

  return (
    <section data-slot="experience-grid" className={cn('space-y-5', className)}>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-ink-strong">{title}</h2>
        {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {experiences.map((experience, index) => (
          <ExperienceCard
            key={experience.product.id}
            experience={experience}
            priority={!deferImages && index < PRIORITY_CARDS}
          />
        ))}
      </div>
    </section>
  );
}
