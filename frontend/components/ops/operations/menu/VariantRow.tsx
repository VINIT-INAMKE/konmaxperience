'use client';

import { Loader2, Pencil, Save, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format/currency';
import { STATUS_BADGE } from '@/lib/status-styles';
import { PRODUCT_STATUS_LABELS } from '@/lib/types/catalog';
import type {
  ProductStatus,
  ProductVariant,
  StockMode,
} from '@/lib/types/catalog';

const PRODUCT_STATUSES: readonly ProductStatus[] = ['draft', 'active', 'archived'];

/**
 * One row's edit buffer. Every numeric field is held as a string because the
 * inputs are text-shaped: `''` means "leave this alone", which is a state a
 * `number` cannot carry and which the upsert DTO relies on (an omitted key is
 * not written, so a blank threshold keeps whatever the row already had).
 */
export interface VariantDraft {
  name: string;
  sku: string;
  price_delta: string;
  stock_on_hand: string;
  low_stock_threshold: string;
  is_default: boolean;
  status: ProductStatus;
}

export function draftFromVariant(variant: ProductVariant): VariantDraft {
  return {
    name: variant.name,
    sku: variant.sku,
    price_delta: String(variant.price_delta ?? 0),
    stock_on_hand: String(variant.stock_on_hand ?? 0),
    low_stock_threshold:
      variant.low_stock_threshold === null ? '' : String(variant.low_stock_threshold),
    is_default: variant.is_default,
    status: variant.status,
  };
}

export function emptyDraft(isFirst: boolean): VariantDraft {
  return {
    name: '',
    sku: '',
    price_delta: '0',
    stock_on_hand: '0',
    low_stock_threshold: '',
    is_default: isFirst,
    status: 'active',
  };
}

/** `'12.50'` → `12.5`; `''` and anything unparseable → `null`. */
export function parseDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusBadgeClass(status: ProductStatus): string {
  if (status === 'active') return STATUS_BADGE.good;
  if (status === 'draft') return STATUS_BADGE.warning;
  return STATUS_BADGE.muted;
}

interface VariantRowProps {
  /** `null` renders the "add variant" draft row. */
  variant: ProductVariant | null;
  basePrice: number;
  stockMode: StockMode;
  isEditing: boolean;
  /** The live edit buffer — present only while `isEditing`. */
  draft: VariantDraft | null;
  isSaving: boolean;
  /** Another row is mid-write; this row's controls stay inert until it settles. */
  isBusy: boolean;
  error: string | null;
  onDraftChange: (patch: Partial<VariantDraft>) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onArchive: () => void;
}

export function VariantRow({
  variant,
  basePrice,
  stockMode,
  isEditing,
  draft,
  isSaving,
  isBusy,
  error,
  onDraftChange,
  onEdit,
  onCancel,
  onSave,
  onArchive,
}: VariantRowProps) {
  const tracksStock = stockMode === 'tracked';
  const fieldId = variant ? variant.id : 'new';

  // The number the storefront actually charges. Shown live from the buffer while
  // editing so a price_delta is never guessed at.
  const liveDelta = isEditing && draft ? (parseDecimal(draft.price_delta) ?? 0) : (variant?.price_delta ?? 0);
  const effectivePrice = basePrice + liveDelta;

  const isLowStock =
    !!variant &&
    variant.low_stock_threshold !== null &&
    variant.stock_on_hand <= variant.low_stock_threshold;

  if (isEditing && draft) {
    return (
      <div className="rounded-lg border border-line-strong bg-surface-raised p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`variant-name-${fieldId}`} className="text-xs">
              Name
            </Label>
            <Input
              id={`variant-name-${fieldId}`}
              className="h-8 text-sm"
              placeholder="e.g. 500 g"
              value={draft.name}
              onChange={(e) => onDraftChange({ name: e.target.value })}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`variant-sku-${fieldId}`} className="text-xs">
              SKU
            </Label>
            <Input
              id={`variant-sku-${fieldId}`}
              className="h-8 text-sm font-mono"
              placeholder="SRDGH-500"
              value={draft.sku}
              onChange={(e) => onDraftChange({ sku: e.target.value })}
              disabled={isSaving || !!variant}
            />
            <p className="text-[11px] leading-tight text-ink-faint">
              {variant
                ? 'The SKU is the upsert key, so it cannot be changed here — archive this variant and add a new one instead.'
                : 'SKUs are globally unique. Reusing one rewrites that variant, wherever it lives.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`variant-delta-${fieldId}`} className="text-xs">
              Price delta (INR)
            </Label>
            <Input
              id={`variant-delta-${fieldId}`}
              className="h-8 text-sm"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={draft.price_delta}
              onChange={(e) => onDraftChange({ price_delta: e.target.value })}
              disabled={isSaving}
            />
            <p className="text-[11px] leading-tight text-ink-faint">
              Charged as {formatCurrency(effectivePrice)} — base {formatCurrency(basePrice)}
              {liveDelta !== 0
                ? ` ${liveDelta > 0 ? '+' : '−'} ${formatCurrency(Math.abs(liveDelta))}`
                : ''}
              .
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select
              value={draft.status}
              onValueChange={(v) => onDraftChange({ status: (v as ProductStatus) ?? 'active' })}
              disabled={isSaving}
            >
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue placeholder="Select status">
                  {(value: string) =>
                    PRODUCT_STATUS_LABELS[value as ProductStatus] ?? 'Select status'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PRODUCT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stock only exists for `tracked` products. For `derived_from_recipe`
              it comes from the BOM and for `capacity` from the event, so showing
              an editable number here would be a lie. */}
          {tracksStock && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`variant-stock-${fieldId}`} className="text-xs">
                  Stock on hand
                </Label>
                <Input
                  id={`variant-stock-${fieldId}`}
                  className="h-8 text-sm"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={draft.stock_on_hand}
                  onChange={(e) => onDraftChange({ stock_on_hand: e.target.value })}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`variant-threshold-${fieldId}`} className="text-xs">
                  Low-stock threshold
                </Label>
                <Input
                  id={`variant-threshold-${fieldId}`}
                  className="h-8 text-sm"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="No alert"
                  value={draft.low_stock_threshold}
                  onChange={(e) => onDraftChange({ low_stock_threshold: e.target.value })}
                  disabled={isSaving}
                />
                <p className="text-[11px] leading-tight text-ink-faint">
                  Raises a <span className="font-mono">stock.low</span> signal at or below this
                  number. Leaving it blank keeps the current setting.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Switch
            id={`variant-default-${fieldId}`}
            checked={draft.is_default}
            onCheckedChange={(checked) => onDraftChange({ is_default: checked })}
            disabled={isSaving || (!!variant && variant.is_default)}
          />
          <Label
            htmlFor={`variant-default-${fieldId}`}
            className="text-sm cursor-pointer select-none"
          >
            Default variant
          </Label>
          <span className="text-[11px] text-ink-faint">
            {variant?.is_default
              ? 'Promote another variant to move the default.'
              : 'Turning this on clears the flag from the current default.'}
          </span>
        </div>

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs px-3"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Save className="size-3.5" />
                {variant ? 'Save variant' : 'Add variant'}
              </span>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs px-3"
            onClick={onCancel}
            disabled={isSaving}
          >
            <X className="size-3.5 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (!variant) return null;

  return (
    <div
      className={cn(
        'rounded-lg border p-3 flex items-start gap-3 flex-wrap',
        variant.status === 'archived' ? 'opacity-60' : undefined,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{variant.name}</span>
          {variant.is_default && (
            <Badge variant="outline" className={STATUS_BADGE.info}>
              Default
            </Badge>
          )}
          <Badge variant="outline" className={statusBadgeClass(variant.status)}>
            {PRODUCT_STATUS_LABELS[variant.status]}
          </Badge>
        </div>

        <p className="text-xs font-mono text-ink-faint truncate">{variant.sku}</p>

        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-ink-muted">
          <span className="font-medium text-ink">{formatCurrency(effectivePrice)}</span>
          <span>
            base {formatCurrency(basePrice)}
            {variant.price_delta !== 0
              ? ` ${variant.price_delta > 0 ? '+' : '−'} ${formatCurrency(Math.abs(variant.price_delta))}`
              : ''}
          </span>
          {tracksStock && (
            <span className={isLowStock ? 'text-[var(--status-warning)] font-medium' : undefined}>
              {variant.stock_on_hand} in stock
              {variant.low_stock_threshold !== null
                ? ` · alert at ${variant.low_stock_threshold}`
                : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs px-2.5"
          onClick={onEdit}
          disabled={isBusy}
        >
          <Pencil className="size-3 mr-1" />
          Edit
        </Button>
        <button
          type="button"
          className="p-1.5 rounded text-ink-muted transition-colors motion-reduce:transition-none hover:text-destructive disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          onClick={onArchive}
          disabled={isBusy || variant.status === 'archived'}
          aria-label={`Archive variant ${variant.name}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
