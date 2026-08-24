'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { reportError } from '@/lib/report-error';
import { MediaThumb } from './MediaThumb';
import { MediaUploader } from './MediaUploader';
import type { ProductMedia } from '@/lib/types/catalog';

interface MediaManagerProps {
  productId: string;
  /** Server order — the staff include already sorts by `sort_order asc`. */
  media: ProductMedia[];
  onChanged: () => void;
}

export function MediaManager({ productId, media, onChanged }: MediaManagerProps) {
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [editingAltId, setEditingAltId] = useState<string | null>(null);
  const [altDraft, setAltDraft] = useState('');
  const [altError, setAltError] = useState<string | null>(null);
  const [isSavingAlt, setIsSavingAlt] = useState(false);
  const [deleting, setDeleting] = useState<ProductMedia | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const byId = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);

  /**
   * Rewriting a row's `sort_order` replaces it, so its id changes. The optimistic
   * order therefore only survives while every id it names still exists; the
   * moment the refetch lands with fresh ids it falls away on its own, with no
   * effect and no flash of the pre-drag order in between.
   */
  const displayed = useMemo(() => {
    if (
      pendingOrder &&
      pendingOrder.length === media.length &&
      pendingOrder.every((id) => byId.has(id))
    ) {
      return pendingOrder.map((id) => byId.get(id) as ProductMedia);
    }
    return media;
  }, [pendingOrder, media, byId]);

  const isBusy = isReordering || isSavingAlt || isDeleting;
  const nextSortOrder = media.length
    ? Math.max(...media.map((m) => m.sort_order)) + 1
    : 0;

  /**
   * There is no `PATCH /catalog/media/:id` — the catalog controller offers only
   * `POST /catalog/products/:id/media` and `DELETE /catalog/media/:id`. Editing a
   * row therefore means writing the replacement first and dropping the original
   * second: a failed create loses nothing, whereas a delete-first order would
   * lose the image outright. The R2 object is untouched either way; only the
   * database row is replaced.
   */
  const recreate = async (
    row: ProductMedia,
    patch: { alt?: string; sort_order?: number },
  ): Promise<void> => {
    await apiClient.post<ProductMedia>(`/catalog/products/${productId}/media`, {
      url: row.url,
      alt: patch.alt ?? row.alt,
      kind: row.kind,
      sort_order: patch.sort_order ?? row.sort_order,
    });
    await apiClient.delete(`/catalog/media/${row.id}`);
  };

  const applyOrder = async (nextIds: string[]) => {
    setPendingOrder(nextIds);
    setIsReordering(true);
    try {
      for (let index = 0; index < nextIds.length; index += 1) {
        const row = byId.get(nextIds[index]);
        if (!row || row.sort_order === index) continue;
        await recreate(row, { sort_order: index });
      }
      toast.success('Gallery order saved.');
      onChanged();
    } catch (err) {
      reportError(err, { scope: 'MediaManager.reorder', productId });
      toast.error(err instanceof Error ? err.message : 'The new order could not be saved.');
      setPendingOrder(null);
      onChanged();
    } finally {
      setIsReordering(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = displayed.map((m) => m.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    void applyOrder(arrayMove(ids, from, to));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= displayed.length) return;
    const ids = displayed.map((m) => m.id);
    void applyOrder(arrayMove(ids, index, target));
  };

  const handleSaveAlt = async (row: ProductMedia) => {
    const value = altDraft.trim();
    if (!value) {
      setAltError('Alt text is required — the storefront gallery and the OG card both read it.');
      return;
    }
    if (value === row.alt) {
      setEditingAltId(null);
      return;
    }
    setIsSavingAlt(true);
    setAltError(null);
    try {
      await recreate(row, { alt: value });
      toast.success('Alt text saved.');
      setEditingAltId(null);
      onChanged();
    } catch (err) {
      reportError(err, { scope: 'MediaManager.alt', mediaId: row.id });
      const msg = err instanceof Error ? err.message : 'The alt text could not be saved.';
      setAltError(msg);
      toast.error(msg);
    } finally {
      setIsSavingAlt(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/catalog/media/${deleting.id}`);
      toast.success('Image removed.');
      setDeleting(null);
      setPendingOrder(null);
      onChanged();
    } catch (err) {
      reportError(err, { scope: 'MediaManager.delete', mediaId: deleting.id });
      toast.error(err instanceof Error ? err.message : 'The image could not be removed.');
    } finally {
      setIsDeleting(false);
    }
  };

  const deletingIsCover = !!deleting && displayed[0]?.id === deleting.id;

  return (
    <section className="space-y-3" aria-label="Product media">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold">Media</h3>
        <p className="text-xs text-ink-muted">
          The first image is the one the storefront card, the product page and the share preview
          lead with. Drag, or use the arrows, to change which that is.
        </p>
      </div>

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 px-4 text-center">
          <ImageIcon className="size-8 text-ink-faint" />
          <p className="text-sm font-medium">No images yet</p>
          <p className="text-xs text-ink-muted max-w-xs">
            The storefront falls back to a placeholder tile until this product has at least one
            image.
          </p>
        </div>
      ) : (
        <div className="relative">
          {isReordering && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-surface/70">
              <span className="flex items-center gap-2 text-xs text-ink-muted">
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                Saving order...
              </span>
            </div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayed.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {displayed.map((row, index) => (
                  <MediaThumb
                    key={row.id}
                    media={row}
                    index={index}
                    total={displayed.length}
                    disabled={isBusy}
                    isEditingAlt={editingAltId === row.id}
                    altDraft={altDraft}
                    altError={editingAltId === row.id ? altError : null}
                    isSavingAlt={isSavingAlt && editingAltId === row.id}
                    onAltDraftChange={setAltDraft}
                    onStartEditAlt={() => {
                      setEditingAltId(row.id);
                      setAltDraft(row.alt);
                      setAltError(null);
                    }}
                    onCancelEditAlt={() => {
                      setEditingAltId(null);
                      setAltError(null);
                    }}
                    onSaveAlt={() => void handleSaveAlt(row)}
                    onMove={(direction) => handleMove(index, direction)}
                    onDelete={() => setDeleting(row)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <MediaUploader
        productId={productId}
        nextSortOrder={nextSortOrder}
        disabled={isBusy}
        onUploaded={onChanged}
      />

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove image</DialogTitle>
            <DialogDescription>
              {deletingIsCover
                ? 'This is the cover image. Removing it promotes the next one — or leaves the storefront on its placeholder tile if there is no next one. This cannot be undone.'
                : 'Remove this image from the product? This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteConfirm()}
              disabled={isDeleting}
            >
              {isDeleting ? 'Removing...' : 'Remove image'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
