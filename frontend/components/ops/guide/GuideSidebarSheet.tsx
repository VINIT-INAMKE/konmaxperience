'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DynamicIcon } from './DynamicIcon';
import { cn } from '@/lib/utils';
import type { GuideSection } from '@/lib/types/guides';

interface GuideSidebarSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: GuideSection[];
  activeSectionSlug?: string;
  activePageSlug?: string;
  onSearchOpen?: () => void;
}

export function GuideSidebarSheet({
  open,
  onOpenChange,
  sections,
  activeSectionSlug,
  activePageSlug,
  onSearchOpen,
}: GuideSidebarSheetProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(sections.map((s) => s.id)),
  );

  function toggleSection(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0" showCloseButton={false}>
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4" />
            <span className="text-[16px] font-semibold">Guide</span>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close guide navigation"
            className="size-9 rounded-md hover:bg-muted flex items-center justify-center"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Search trigger */}
        <div className="px-2 pt-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-[14px] text-muted-foreground px-3 py-2"
            onClick={() => { onOpenChange(false); onSearchOpen?.(); }}
          >
            <Search className="size-4" />
            Search guides...
          </Button>
          <Separator className="my-2" />
        </div>

        {/* Body */}
        <ScrollArea className="flex-1">
          <nav className="p-2">
            {sections.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const sortedPages = [...section.pages].sort(
                (a, b) => a.sort_order - b.sort_order,
              );

              return (
                <div key={section.id} className="mb-1">
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-[14px] font-semibold rounded-md hover:bg-muted transition-colors"
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0" />
                    )}
                    <DynamicIcon
                      name={section.icon ?? 'BookOpen'}
                      className="size-4 shrink-0"
                      style={{ color: section.accent_color ?? undefined }}
                    />
                    <span className="truncate">{section.title}</span>
                  </button>

                  {/* Page list */}
                  {isExpanded && sortedPages.length > 0 && (
                    <div className="ml-6 space-y-0.5">
                      {sortedPages.map((page) => {
                        const isActive =
                          section.slug === activeSectionSlug &&
                          page.slug === activePageSlug;

                        return (
                          <Link
                            key={page.id}
                            href={'/guide/' + section.slug + '/' + page.slug}
                            onClick={() => onOpenChange(false)}
                            className={cn(
                              'block px-2 py-1.5 text-[14px] rounded-md transition-colors',
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                            {...(isActive ? { 'aria-current': 'page' as const } : {})}
                          >
                            {page.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
