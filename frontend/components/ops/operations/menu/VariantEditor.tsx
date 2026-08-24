'use client';

import { useMemo, useState } from 'react';
import { Layers, Plus } from 'lucide-react';
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
import { formatCurrency } from '@/lib/format/currency';
import { reportError } from '@/lib/report-error';
import {
  VariantRow,
  draftFromVariant,
  emptyDraft,
  parseDecimal,
  type VariantDraft,
} from './VariantRow';
import type { ProductVariant, StockMode } from '@/lib/types/catalog';

/** Sentinel id for the unsaved "add variant" row. */
const NEW_ROW = '__new__';

/** `PATCH /catalog/variants` — `UpsertProductVariantDto`. */
interface UpsertVariantPayload {
  product_id: string;
  name: string;
  sku: string;
  price_delta?: number;
  stock_on_hand?: number;
  low_stock_threshold?: number;
  is_default?: boolean;
  status?: ProductVariant['status'];
}

/**
 * Archived variants sink to the bottom, the default floats to the top, and the
 * rest keep a stable alphabetical order — the list is short enough that a
 * predictable one beats an insertion-ordered one.
 */
function sortVariants(variants: ProductVariant[]): ProductVariant[] {
  return [...variants].sort((a, b) => {
    const aArchived = a.status === 'archived' ? 1 : 0;
    const bArchived = b.status === 'archived' ? 1 : 0;
    if (aArchived !== bArchived) return aArchived - bArchived;
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

interface VariantEditorProps {
  productId: string;
  basePrice: number;
  stockMode: StockMode;
  variants: ProductVariant[];
  /** Refetches the staff catalog so the rows below reflect what the server stored. */
  onChanged: () => void;
}

export function VariantEditor({
  productId,
  basePrice,
  stockMode,
  variants,
  onChanged,
}: VariantEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VariantDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<ProductVariant | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const ordered = useMemo(() => sortVariants(variants), [variants]);
  const live = useMemo(() => variants.filter((v) => v.status !== 'archived'), [variants]);

  const startEdit = (variant: ProductVariant) => {
    setEditingId(variant.id);
    setDraft(draftFromVariant(variant));
    setRowError(null);
  };

  const startCreate = () => {
    setEditingId(NEW_ROW);
    setDraft(emptyDraft(live.length === 0));
    setRowError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setRowError(null);
  };

  /** Returns a message when the buffer cannot be persisted, `null` when it can. */
  const validate = (buffer: VariantDraft, existing: ProductVariant | null): string | null => {
    const name = buffer.name.trim();
    const sku = buffer.sku.trim();
    if (!name) return 'Give the variant a name — it is what the storefront shows in the picker.';
    if (!sku) return 'A SKU is required. It is the key the upsert writes against.';

    // The backend upserts on `sku` alone, so reusing one silently rewrites the
    // other variant — including moving it to this product. Catch what we can see.
    const collision = variants.find(
      (v) => v.sku.trim().toLowerCase() === sku.toLowerCase() && v.id !== existing?.id,
    );
    if (collision) {
      return `SKU "${sku}" already belongs to the variant "${collision.name}". Pick another.`;
    }

    if (buffer.price_delta.trim() && parseDecimal(buffer.price_delta) === null) {
      return 'The price delta must be a number.';
    }
    const delta = parseDecimal(buffer.price_delta) ?? 0;
    if (basePrice + delta < 0) {
      return `That delta puts the price at ${formatCurrency(basePrice + delta)}. It cannot be negative.`;
    }

    if (stockMode === 'tracked') {
      const stock = parseDecimal(buffer.stock_on_hand);
      if (buffer.stock_on_hand.trim() && (stock === null || stock < 0)) {
        return 'Stock on hand must be zero or more.';
      }
      const threshold = parseDecimal(buffer.low_stock_threshold);
      if (buffer.low_stock_threshold.trim() && (threshold === null || threshold < 0)) {
        return 'The low-stock threshold must be zero or more.';
      }
    }

    return null;
  };

  const buildPayload = (buffer: VariantDraft): UpsertVariantPayload => {
    const payload: UpsertVariantPayload = {
      product_id: productId,
      name: buffer.name.trim(),
      sku: buffer.sku.trim(),
      price_delta: parseDecimal(buffer.price_delta) ?? 0,
      is_default: buffer.is_default,
      status: buffer.status,
    };

    // Stock is meaningless outside `tracked` (SPEC 3.3) — never write it there.
    if (stockMode === 'tracked') {
      const stock = parseDecimal(buffer.stock_on_hand);
      if (stock !== null) payload.stock_on_hand = stock;
      const threshold = parseDecimal(buffer.low_stock_threshold);
      if (threshold !== null) payload.low_stock_threshold = threshold;
    }

    return payload;
  };

  const handleSave = async () => {
    if (!draft || !editingId) return;
    const existing = editingId === NEW_ROW ? null : (variants.find((v) => v.id === editingId) ?? null);

    const message = validate(draft, existing);
    if (message) {
      setRowError(message);
      return;
    }

    setIsSaving(true);
    setRowError(null);
    try {
      const payload = buildPayload(draft);
      const saved = await apiClient.patch<ProductVariant>('/catalog/variants', payload);

      // Exactly one default, enforced here because the backend does not.
      // Promote first, then demote: a failure on the promote leaves the old
      // default standing, which is strictly better than leaving none at all.
      if (draft.is_default) {
        const previous = variants.find(
          (v) => v.is_default && v.id !== saved.id && v.sku !== payload.sku,
        );
        if (previous) {
          await apiClient.patch<ProductVariant>('/catalog/variants', {
            product_id: previous.product_id,
            name: previous.name,
            sku: previous.sku,
            is_default: false,
          });
        }
      }

      toast.success(existing ? `Variant "${payload.name}" saved.` : `Variant "${payload.name}" added.`);
      cancelEdit();
      onChanged();
    } catch (err) {
      reportError(err, { scope: 'VariantEditor.save', productId });
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setRowError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archiving) return;
    setIsArchiving(true);
    try {
      await apiClient.delete(`/catalog/variants/${archiving.id}`);
      toast.success(`Variant "${archiving.name}" archived.`);
      setArchiving(null);
      onChanged();
    } catch (err) {
      reportError(err, { scope: 'VariantEditor.archive', variantId: archiving.id });
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsArchiving(false);
    }
  };

  const hasNoDefault = live.length > 0 && !live.some((v) => v.is_default);

  return (
    <section className="space-y-3" aria-label="Product variants">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">Variants</h3>
          <p className="text-xs text-ink-muted">
            Each variant is a separate cart line on the storefront, priced at the base price plus
            its delta.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs px-3"
          onClick={startCreate}
          disabled={editingId !== null}
        >
          <Plus className="size-3.5 mr-1" />
          Add variant
        </Button>
      </div>

      {hasNoDefault && (
        <p className="text-xs text-[var(--status-warning)]">
          No variant is marked as the default. The storefront picker will have nothing pre-selected
          until one is.
        </p>
      )}

      {ordered.length === 0 && editingId === null ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 px-4 text-center">
          <Layers className="size-8 text-ink-faint" />
          <p className="text-sm font-medium">No variants yet</p>
          <p className="text-xs text-ink-muted max-w-xs">
            Products sell at their base price with no picker until a variant exists. Add one for
            each size, weight or option you stock.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordered.map((variant) => (
            <VariantRow
              key={variant.id}
              variant={variant}
              basePrice={basePrice}
              stockMode={stockMode}
              isEditing={editingId === variant.id}
              draft={editingId === variant.id ? draft : null}
              isSaving={isSaving && editingId === variant.id}
              isBusy={editingId !== null || isArchiving}
              error={editingId === variant.id ? rowError : null}
              onDraftChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
              onEdit={() => startEdit(variant)}
              onCancel={cancelEdit}
              onSave={() => void handleSave()}
              onArchive={() => setArchiving(variant)}
            />
          ))}

          {editingId === NEW_ROW && (
            <VariantRow
              variant={null}
              basePrice={basePrice}
              stockMode={stockMode}
              isEditing
              draft={draft}
              isSaving={isSaving}
              isBusy={false}
              error={rowError}
              onDraftChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
              onEdit={() => undefined}
              onCancel={cancelEdit}
              onSave={() => void handleSave()}
              onArchive={() => undefined}
            />
          )}
        </div>
      )}

      <Dialog
        open={!!archiving}
        onOpenChange={(open) => {
          if (!open) setArchiving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive variant</DialogTitle>
            <DialogDescription>
              Archive <span className="font-medium">{archiving?.name}</span>? It disappears from the
              storefront picker but stays attached to the orders that already bought it. Set its
              status back to Active to bring it back.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiving(null)} disabled={isArchiving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleArchiveConfirm()}
              disabled={isArchiving}
            >
              {isArchiving ? 'Archiving...' : 'Archive variant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
