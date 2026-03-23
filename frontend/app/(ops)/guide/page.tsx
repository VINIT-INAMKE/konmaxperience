'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { GuideSection } from '@/lib/types/guides';
import { GuideSectionCard } from '@/components/ops/guide/GuideSectionCard';
import { GuideSectionIndexSkeleton } from '@/components/ops/guide/GuideSectionIndexSkeleton';
import { GuidePreviewBanner } from '@/components/ops/guide/GuidePreviewBanner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export default function GuidePage() {
  const [previewRole, setPreviewRole] = useState<string | null>(null);
  const roleCode = useAuthStore((s) => s.user?.roleCode);
  const isAdmin = roleCode === 'FOUNDER_ADMIN' || roleCode === 'TECH_LEAD';

  const {
    data: sections,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['guide', 'sections'],
    queryFn: () => apiClient.get<GuideSection[]>('/guide/sections'),
  });

  const displaySections = previewRole
    ? (sections ?? []).filter((s) => s.role_codes.includes(previewRole))
    : sections;

  function openSearch() {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-[24px] font-semibold leading-[1.2]">
              Your Guide
            </h1>
            <p className="text-[14px] text-muted-foreground">
              Resources for your role. Browse a section to get started.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-[200px] justify-start gap-2 text-[14px] text-muted-foreground"
              onClick={openSearch}
            >
              <Search className="size-4" />
              Search guides...
              <kbd className="ml-auto inline-flex items-center px-2 py-1 rounded border bg-muted text-[11px] font-mono font-semibold">
                {typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)
                  ? '\u2318K'
                  : 'Ctrl K'}
              </kbd>
            </Button>
          </div>
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
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h1 className="text-[24px] font-semibold leading-[1.2]">
            Your Guide
          </h1>
          <p className="text-[14px] text-muted-foreground">
            Resources for your role. Browse a section to get started.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search trigger button */}
          <Button
            variant="outline"
            size="sm"
            className="w-[200px] justify-start gap-2 text-[14px] text-muted-foreground"
            onClick={openSearch}
          >
            <Search className="size-4" />
            Search guides...
            <kbd className="ml-auto inline-flex items-center px-2 py-1 rounded border bg-muted text-[11px] font-mono font-semibold">
              {typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)
                ? '\u2318K'
                : 'Ctrl K'}
            </kbd>
          </Button>

          {/* Admin role selector */}
          {isAdmin && (
            <Select
              value={previewRole ?? 'OWN'}
              onValueChange={(v) => setPreviewRole((v as string) === 'OWN' ? null : (v as string))}
            >
              <SelectTrigger className="w-[200px]" aria-label="Preview guide as role">
                <SelectValue placeholder="Preview as role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OWN">Your view</SelectItem>
                <SelectItem value="BACKEND_LEAD">Backend Lead</SelectItem>
                <SelectItem value="BI_LEAD">BI Lead</SelectItem>
                <SelectItem value="DESIGN_OUTREACH_LEAD">Design/Outreach Lead</SelectItem>
                <SelectItem value="FOUNDER_ADMIN">Founder/Admin</SelectItem>
                <SelectItem value="FRONTEND_LEAD">Frontend Lead</SelectItem>
                <SelectItem value="PROCUREMENT_LEAD">Procurement Lead</SelectItem>
                <SelectItem value="TALENT_LEAD">Talent Lead</SelectItem>
                <SelectItem value="TECH_LEAD">Tech Lead</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {previewRole && (
        <GuidePreviewBanner previewRole={previewRole} onReset={() => setPreviewRole(null)} />
      )}

      {displaySections && displaySections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displaySections.map((s) => (
            <GuideSectionCard section={s} key={s.id} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BookOpen className="size-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-[20px] font-semibold mb-2">
            No guides visible for this role
          </h2>
          <p className="text-[14px] text-muted-foreground max-w-sm">
            This role does not have any guide sections assigned.
          </p>
        </div>
      )}
    </div>
  );
}
