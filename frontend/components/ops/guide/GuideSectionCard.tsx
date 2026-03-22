'use client';

import Link from 'next/link';
import { MagicCard } from '@/components/ui/magic-card';
import { BorderBeam } from '@/components/ui/border-beam';
import { BEAM_FROM, BEAM_TO } from '@/lib/brand-colors';
import type { GuideSection } from '@/lib/types/guides';
import { DynamicIcon } from '@/components/ops/guide/DynamicIcon';

interface GuideSectionCardProps {
  section: GuideSection;
}

export function GuideSectionCard({ section }: GuideSectionCardProps) {
  const totalMinutes = section.pages.reduce(
    (sum, p) => sum + (p.estimated_read_time ?? 1),
    0,
  );

  return (
    <Link href={'/guide/' + section.slug}>
      <MagicCard
        mode="gradient"
        className="rounded-xl cursor-pointer relative overflow-hidden"
      >
        <BorderBeam
          size={50}
          duration={6}
          colorFrom={BEAM_FROM}
          colorTo={BEAM_TO}
        />
        <div className="p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className="size-10 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: section.accent_color
                  ? section.accent_color + '20'
                  : undefined,
              }}
            >
              <DynamicIcon
                name={section.icon ?? 'BookOpen'}
                className="size-5"
                style={{
                  color: section.accent_color ?? undefined,
                }}
              />
            </div>
            <h2 className="text-[20px] font-semibold leading-[1.2]">
              {section.title}
            </h2>
          </div>
          {section.description && (
            <p className="text-[14px] text-muted-foreground leading-[1.5]">
              {section.description}
            </p>
          )}
          <span className="text-[14px] text-muted-foreground">
            {section.pages.length} pages &middot; ~{totalMinutes} min read
          </span>
        </div>
      </MagicCard>
    </Link>
  );
}
