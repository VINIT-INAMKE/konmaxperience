'use client';

import { use, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { GuideSection, GuidePage } from '@/lib/types/guides';
import { GuidePageHeader } from '@/components/ops/guide/GuidePageHeader';
import { GuidePageSkeleton } from '@/components/ops/guide/GuidePageSkeleton';
import { GuideSidebarSheet } from '@/components/ops/guide/GuideSidebarSheet';

const GuideProseRenderer = dynamic(
  () =>
    import('@/components/ops/guide/GuideProseRenderer').then(
      (m) => m.GuideProseRenderer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse h-40 bg-muted rounded-lg mt-8" />
    ),
  },
);

export default function PageReadingView({
  params,
}: {
  params: Promise<{ sectionSlug: string; pageSlug: string }>;
}) {
  const { sectionSlug, pageSlug } = use(params);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Query 1: Fetch all sections (shared cache from section index/detail pages)
  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['guide', 'sections'],
    queryFn: () => apiClient.get<GuideSection[]>('/guide/sections'),
  });

  // Resolve section and page from cached sections
  const section = sections?.find((s) => s.slug === sectionSlug);
  const pageEntry = section?.pages.find((p) => p.slug === pageSlug);

  // Query 2: Fetch full page content using the page UUID
  const {
    data: page,
    isLoading: pageLoading,
    isError: pageError,
  } = useQuery({
    queryKey: ['guide', 'page', pageEntry?.id],
    queryFn: () => apiClient.get<GuidePage>(`/guide/pages/${pageEntry!.id}`),
    enabled: !!pageEntry?.id,
  });

  // Loading state
  if (sectionsLoading || (pageEntry && pageLoading)) {
    return <GuidePageSkeleton />;
  }

  // Error / not found
  if (pageError || (sections && (!section || !pageEntry))) {
    return (
      <div className="max-w-[720px] mx-auto w-full px-6 py-16">
        <h1 className="text-[24px] font-semibold">
          Could not load this guide
        </h1>
        <p className="text-[14px] text-muted-foreground mt-2">
          Something went wrong loading the content. Try refreshing the page.
        </p>
        <Link
          href="/guide"
          className="inline-block mt-4 text-[14px] text-primary hover:underline"
        >
          Back to Guide
        </Link>
      </div>
    );
  }

  if (!page || !section) {
    return <GuidePageSkeleton />;
  }

  return (
    <div className="relative">
      {/* Sidebar trigger button */}
      <button
        onClick={() => setSidebarOpen(true)}
        aria-label="Open guide navigation"
        className="fixed top-20 left-4 z-30 size-9 rounded-md bg-background border border-border hover:bg-muted flex items-center justify-center shadow-sm lg:left-[256px]"
      >
        <BookOpen className="size-4" />
      </button>

      {/* Prose container */}
      <div className="max-w-[720px] mx-auto w-full px-6 py-16">
        <GuidePageHeader
          sectionTitle={section.title}
          sectionSlug={section.slug}
          pageTitle={page.title}
          summary={page.summary}
          estimatedReadTime={page.estimated_read_time}
          updatedAt={page.updated_at}
        />

        <div className="mt-8">
          <GuideProseRenderer content={page.content} />
        </div>
      </div>

      {/* Sidebar sheet */}
      <GuideSidebarSheet
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        sections={sections ?? []}
        activeSectionSlug={sectionSlug}
        activePageSlug={pageSlug}
      />
    </div>
  );
}
