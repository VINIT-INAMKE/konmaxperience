'use client';

import {
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  FileText,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DynamicIcon } from '@/components/ops/guide/DynamicIcon';
import { STATUS_BADGE } from '@/lib/status-styles';
import { ROLE_DISPLAY_NAMES, RoleCode } from '@/lib/types/roles';
import type { GuideSection, GuideSectionPage } from '@/lib/types/guides';

interface GuideSectionAdminRowProps {
  section: GuideSection;
  isExpanded: boolean;
  onToggle: () => void;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreatePage: () => void;
  onEditPage: (pageId: string) => void;
  onDeletePage: (page: GuideSectionPage) => void;
  onMovePage: (page: GuideSectionPage, dir: 'up' | 'down', pages: GuideSectionPage[]) => void;
}

export function GuideSectionAdminRow({
  section,
  isExpanded,
  onToggle,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onCreatePage,
  onEditPage,
  onDeletePage,
  onMovePage,
}: GuideSectionAdminRowProps) {
  const sortedPages = [...section.pages].sort((a, b) => a.sort_order - b.sort_order);
  const roleDisplayNames = section.role_codes.map(
    (code) => ROLE_DISPLAY_NAMES[code as RoleCode] || code,
  );
  const visibleRoles = roleDisplayNames.slice(0, 3);
  const remainingRoleCount = roleDisplayNames.length - 3;

  return (
    <div>
      {/* Section row */}
      <div
        className="group relative flex items-center gap-3 px-4 py-3 rounded-xl border bg-card hover:bg-muted/50 cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
      >
        {/* Section icon */}
        <DynamicIcon
          name={section.icon || 'BookOpen'}
          className="size-5 shrink-0"
          style={{ color: section.accent_color || undefined }}
        />

        {/* Section title */}
        <span className="text-[16px] font-semibold text-foreground truncate">
          {section.title}
        </span>

        {/* Role badges */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {visibleRoles.map((name) => (
            <Badge key={name} variant="secondary" className="text-[12px] px-1.5 py-0">
              {name}
            </Badge>
          ))}
          {remainingRoleCount > 0 && (
            <Badge variant="secondary" className="text-[12px] px-1.5 py-0">
              +{remainingRoleCount} more
            </Badge>
          )}
        </div>

        {/* Status badge */}
        {section.status === 'draft' ? (
          <Badge className={`text-[12px] shrink-0 ${STATUS_BADGE.warning}`}>
            Draft
          </Badge>
        ) : (
          <Badge className={`text-[12px] shrink-0 ${STATUS_BADGE.good}`}>
            Published
          </Badge>
        )}

        {/* Page count */}
        <span className="text-[14px] text-muted-foreground shrink-0">
          {section.pages.length} {section.pages.length === 1 ? 'page' : 'pages'}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions (visible on hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move section up"
          >
            <ChevronUp className={`size-4 ${isFirst ? 'opacity-30' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move section down"
          >
            <ChevronDown className={`size-4 ${isLast ? 'opacity-30' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onEdit}
            aria-label="Edit section"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete section"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {/* Expand/collapse toggle */}
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onToggle}
            aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
          >
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded page list */}
      {isExpanded && (
        <div className="ml-8 space-y-1 py-2">
          {sortedPages.length === 0 && (
            <p className="text-[14px] text-muted-foreground px-4 py-2">
              No pages in this section yet. Add the first page to get started.
            </p>
          )}
          {sortedPages.map((page, idx) => (
            <div
              key={page.id}
              className="group/page flex items-center gap-2 px-4 py-2 hover:bg-muted/50 rounded-lg"
            >
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <span className="text-[14px] truncate">{page.title}</span>

              {/* Page status badge */}
              {page.status === 'draft' ? (
                <Badge className={`text-[12px] shrink-0 ${STATUS_BADGE.warning}`}>
                  Draft
                </Badge>
              ) : (
                <Badge className={`text-[12px] shrink-0 ${STATUS_BADGE.good}`}>
                  Published
                </Badge>
              )}

              <div className="flex-1" />

              {/* Page actions (visible on hover) */}
              <div className="flex items-center gap-1 opacity-0 group-hover/page:opacity-100 transition-opacity shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => onMovePage(page, 'up', sortedPages)}
                  disabled={idx === 0}
                  aria-label="Move page up"
                >
                  <ChevronUp className={`size-3 ${idx === 0 ? 'opacity-30' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => onMovePage(page, 'down', sortedPages)}
                  disabled={idx === sortedPages.length - 1}
                  aria-label="Move page down"
                >
                  <ChevronDown className={`size-3 ${idx === sortedPages.length - 1 ? 'opacity-30' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => onEditPage(page.id)}
                  aria-label="Edit page"
                >
                  <Pencil className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-destructive hover:text-destructive"
                  onClick={() => onDeletePage(page)}
                  aria-label="Delete page"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}

          {/* Add page button */}
          <Button
            variant="ghost"
            size="sm"
            className="ml-4 mt-1"
            onClick={onCreatePage}
          >
            <Plus className="size-4 mr-1" />
            Add Page
          </Button>
        </div>
      )}
    </div>
  );
}
