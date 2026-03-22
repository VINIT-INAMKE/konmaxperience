'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/lib/api-client';
import type { GuideSection } from '@/lib/types/guides';
import { DynamicIcon } from '@/components/ops/guide/DynamicIcon';

export default function SectionPage({
  params,
}: {
  params: Promise<{ sectionSlug: string }>;
}) {
  const { sectionSlug } = use(params);

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
        <Skeleton className="h-4 w-24 rounded-lg" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-7 w-48 rounded-lg" />
        </div>
        <Separator />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <Link
          href="/guide"
          className="inline-flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Guide
        </Link>
        <h1 className="text-[24px] font-semibold">Could not load this guide</h1>
        <p className="text-[14px] text-muted-foreground">
          Something went wrong loading the content. Try refreshing the page.
        </p>
      </div>
    );
  }

  const section = sections?.find((s) => s.slug === sectionSlug);

  if (!section) {
    return (
      <div className="space-y-4">
        <Link
          href="/guide"
          className="inline-flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Guide
        </Link>
        <h1 className="text-[24px] font-semibold">Section not found</h1>
        <p className="text-[14px] text-muted-foreground">
          The section you are looking for does not exist or is not available for
          your role.
        </p>
      </div>
    );
  }

  const sortedPages = [...section.pages].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  return (
    <div className="space-y-4">
      <Link
        href="/guide"
        className="inline-flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Guide
      </Link>

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
            style={{ color: section.accent_color ?? undefined }}
          />
        </div>
        <div>
          <h1 className="text-[24px] font-semibold leading-[1.2]">
            {section.title}
          </h1>
          {section.description && (
            <p className="text-[16px] text-muted-foreground mt-1">
              {section.description}
            </p>
          )}
        </div>
      </div>

      <Separator className="my-4" />

      {sortedPages.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No pages in this section yet.
        </p>
      ) : (
        <div className="space-y-2">
          {sortedPages.map((page) => (
            <Link
              key={page.id}
              href={'/guide/' + sectionSlug + '/' + page.slug}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
            >
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[14px] font-medium">{page.title}</span>
                {page.summary && (
                  <p className="text-[14px] text-muted-foreground truncate">
                    {page.summary}
                  </p>
                )}
              </div>
              <span className="text-[14px] text-muted-foreground shrink-0">
                ~{page.estimated_read_time ?? 1} min read
              </span>
              <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
