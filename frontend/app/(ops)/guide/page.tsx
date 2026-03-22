'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { GuideSection } from '@/lib/types/guides';
import { GuideSectionCard } from '@/components/ops/guide/GuideSectionCard';
import { GuideSectionIndexSkeleton } from '@/components/ops/guide/GuideSectionIndexSkeleton';

export default function GuidePage() {
  const {
    data: sections,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['guide', 'sections'],
    queryFn: () => apiClient.get<GuideSection[]>('/guide/sections'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-[24px] font-semibold leading-[1.2]">
            Your Guide
          </h1>
          <p className="text-[14px] text-muted-foreground">
            Resources for your role. Browse a section to get started.
          </p>
        </div>
        <GuideSectionIndexSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BookOpen className="size-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-[20px] font-semibold mb-2">
          Could not load this guide
        </h2>
        <p className="text-[14px] text-muted-foreground max-w-sm">
          Something went wrong loading the content. Try refreshing the page.
        </p>
      </div>
    );
  }

  if (!sections || sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BookOpen className="size-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-[20px] font-semibold mb-2">No guides yet</h2>
        <p className="text-[14px] text-muted-foreground max-w-sm">
          No guides have been set up for your role yet. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[24px] font-semibold leading-[1.2]">
          Your Guide
        </h1>
        <p className="text-[14px] text-muted-foreground">
          Resources for your role. Browse a section to get started.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((s) => (
          <GuideSectionCard section={s} key={s.id} />
        ))}
      </div>
    </div>
  );
}
