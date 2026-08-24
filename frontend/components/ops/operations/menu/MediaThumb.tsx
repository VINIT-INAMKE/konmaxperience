'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronUp,
  Film,
  GripVertical,
  ImageOff,
  Loader2,
  Pencil,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { ProductMedia } from '@/lib/types/catalog';

interface MediaThumbProps {
  media: ProductMedia;
  index: number;
  total: number;
  disabled: boolean;
  isEditingAlt: boolean;
  altDraft: string;
  altError: string | null;
  isSavingAlt: boolean;
  onAltDraftChange: (value: string) => void;
  onStartEditAlt: () => void;
  onCancelEditAlt: () => void;
  onSaveAlt: () => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}

export function MediaThumb({
  media,
  index,
  total,
  disabled,
  isEditingAlt,
  altDraft,
  altError,
  isSavingAlt,
  onAltDraftChange,
  onStartEditAlt,
  onCancelEditAlt,
  onSaveAlt,
  onMove,
  onDelete,
}: MediaThumbProps) {
  const [failed, setFailed] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: media.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // The first row is what `/p/[slug]` leads with and what the OG card renders,
  // so it is labelled rather than left to be inferred from position alone.
  const isCover = index === 0;
  const isImage = media.kind === 'image';

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border p-2 flex items-start gap-3',
        isCover ? 'border-line-strong bg-surface-raised' : undefined,
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="mt-6 p-1 rounded text-ink-faint cursor-grab touch-none transition-colors motion-reduce:transition-none hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        aria-label={`Reorder ${media.alt || 'image'}, currently position ${index + 1} of ${total}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {isImage && !failed ? (
          <Image
            src={media.url}
            alt={media.alt || 'Product image'}
            fill
            className="object-cover"
            sizes="80px"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-ink-faint">
            {isImage ? <ImageOff className="size-5" /> : <Film className="size-5" />}
            <span className="text-[10px] leading-none">{isImage ? 'Broken' : 'Video'}</span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-ink-muted">#{index + 1}</span>
          {isCover && (
            <Badge variant="outline" className={STATUS_BADGE.info}>
              Cover &amp; OG image
            </Badge>
          )}
          <Badge variant="outline" className={STATUS_BADGE.neutral}>
            {media.kind}
          </Badge>
          {!media.alt && (
            <Badge variant="outline" className={STATUS_BADGE.warning}>
              No alt text
            </Badge>
          )}
        </div>

        {isEditingAlt ? (
          <div className="space-y-1.5">
            <Label htmlFor={`media-alt-${media.id}`} className="text-xs">
              Alt text
            </Label>
            <Input
              id={`media-alt-${media.id}`}
              className="h-8 text-sm"
              value={altDraft}
              onChange={(e) => onAltDraftChange(e.target.value)}
              placeholder="Sourdough loaf, sliced, on a wooden board"
              disabled={isSavingAlt}
            />
            {altError && (
              <p className="text-xs text-destructive" role="alert">
                {altError}
              </p>
            )}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={onSaveAlt}
                disabled={isSavingAlt}
              >
                {isSavingAlt ? (
                  <Loader2 className="size-3 mr-1 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Save className="size-3 mr-1" />
                )}
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2.5"
                onClick={onCancelEditAlt}
                disabled={isSavingAlt}
              >
                <X className="size-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-muted break-words line-clamp-2">
            {media.alt || 'Missing — screen readers and the OG card have nothing to read.'}
          </p>
        )}
      </div>

      {!isEditingAlt && (
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="p-1 rounded text-ink-muted transition-colors motion-reduce:transition-none hover:text-ink disabled:opacity-40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              onClick={() => onMove(-1)}
              disabled={disabled || index === 0}
              aria-label={`Move ${media.alt || 'image'} up`}
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              className="p-1 rounded text-ink-muted transition-colors motion-reduce:transition-none hover:text-ink disabled:opacity-40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              onClick={() => onMove(1)}
              disabled={disabled || index === total - 1}
              aria-label={`Move ${media.alt || 'image'} down`}
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="p-1 rounded text-ink-muted transition-colors motion-reduce:transition-none hover:text-ink disabled:opacity-40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              onClick={onStartEditAlt}
              disabled={disabled}
              aria-label={`Edit alt text for ${media.alt || 'image'}`}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              className="p-1 rounded text-ink-muted transition-colors motion-reduce:transition-none hover:text-destructive disabled:opacity-40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              onClick={onDelete}
              disabled={disabled}
              aria-label={`Delete ${media.alt || 'image'}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
