'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import type { GuideSection } from '@/lib/types/guides';
import { DynamicIcon } from '@/components/ops/guide/DynamicIcon';
import { guideAccentTint } from '@/components/ops/guide/accent';

interface GuideSectionCardProps {
  section: GuideSection;
}

export function GuideSectionCard({ section }: GuideSectionCardProps) {
  const totalMinutes = section.pages.reduce(
    (sum, p) => sum + (p.estimated_read_time ?? 1),
    0,
  );

  return (
    <Link
      href={'/guide/' + section.slug}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
    >
      <Card className="rounded-xl cursor-pointer transition-colors hover:bg-surface-raised motion-reduce:transition-none">
        <div className="p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className="size-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: guideAccentTint(section.accent_color) }}
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
      </Card>
    </Link>
  );
}
