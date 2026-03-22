'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { GuideSectionCard } from '@/components/ops/guide/admin/GuideSectionCard';
import type { GuideSection, GuideSectionPage } from '@/lib/types/guides';

interface GuideSectionListProps {
  sections: GuideSection[];
  onEditSection: (section: GuideSection) => void;
  onDeleteSection: (section: GuideSection) => void;
  onCreatePage: (sectionId: string) => void;
  onEditPage: (pageId: string) => void;
  onDeletePage: (page: GuideSectionPage & { section_id?: string }) => void;
}

export function GuideSectionList({
  sections,
  onEditSection,
  onDeleteSection,
  onCreatePage,
  onEditPage,
  onDeletePage,
}: GuideSectionListProps) {
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

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

  async function moveSection(section: GuideSection, direction: 'up' | 'down') {
    const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order);
    const currentIndex = sorted.findIndex((s) => s.id === section.id);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    const swapTarget = sorted[swapIndex];
    try {
      await Promise.all([
        apiClient.patch(`/guide/sections/${section.id}`, { sort_order: swapTarget.sort_order }),
        apiClient.patch(`/guide/sections/${swapTarget.id}`, { sort_order: section.sort_order }),
      ]);
      await queryClient.invalidateQueries({ queryKey: ['guide-sections-admin'] });
    } catch {
      toast.error('Failed to reorder sections');
    }
  }

  async function movePage(page: GuideSectionPage, direction: 'up' | 'down', sectionPages: GuideSectionPage[]) {
    const sorted = [...sectionPages].sort((a, b) => a.sort_order - b.sort_order);
    const currentIndex = sorted.findIndex((p) => p.id === page.id);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    const swapTarget = sorted[swapIndex];
    try {
      await Promise.all([
        apiClient.patch(`/guide/pages/${page.id}`, { sort_order: swapTarget.sort_order }),
        apiClient.patch(`/guide/pages/${swapTarget.id}`, { sort_order: page.sort_order }),
      ]);
      await queryClient.invalidateQueries({ queryKey: ['guide-sections-admin'] });
    } catch {
      toast.error('Failed to reorder pages');
    }
  }

  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-3">
      {sortedSections.map((section, idx) => (
        <GuideSectionCard
          key={section.id}
          section={section}
          isExpanded={expandedSections.has(section.id)}
          onToggle={() => toggleSection(section.id)}
          isFirst={idx === 0}
          isLast={idx === sortedSections.length - 1}
          onMoveUp={() => moveSection(section, 'up')}
          onMoveDown={() => moveSection(section, 'down')}
          onEdit={() => onEditSection(section)}
          onDelete={() => onDeleteSection(section)}
          onCreatePage={() => onCreatePage(section.id)}
          onEditPage={onEditPage}
          onDeletePage={onDeletePage}
          onMovePage={movePage}
        />
      ))}
    </div>
  );
}
