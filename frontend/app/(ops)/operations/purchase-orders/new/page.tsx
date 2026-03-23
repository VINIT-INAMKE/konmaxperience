'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { NumberTicker } from '@/components/ui/number-ticker';
import { BorderBeam } from '@/components/ui/border-beam';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PurchaseOrderLineRow,
  type LineItemState,
} from '@/components/ops/operations/purchase-orders/PurchaseOrderLineRow';
import { apiClient } from '@/lib/api-client';
import type { Vendor } from '@/lib/types/vendor';
import type { Ingredient } from '@/lib/types/ingredient';
import type { Zone } from '@/lib/types/zone';

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [vendorId, setVendorId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItemState[]>([
    { ingredient_id: '', quantity: '', unit: '', unit_cost: '' },
  ]);

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => apiClient.get<Vendor[]>('/vendors'),
  });

  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => apiClient.get<Ingredient[]>('/ingredients'),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });

  // Default zone to first zone once loaded
  const effectiveZoneId = zoneId || zones[0]?.id || '';

  const activeVendors = useMemo(
    () => vendors.filter((v) => v.status === 'active'),
    [vendors],
  );

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId),
    [vendors, vendorId],
  );

  const grandTotal = useMemo(() => {
    return lineItems.reduce((sum, line) => {
      const qty = Number(line.quantity);
      const cost = Number(line.unit_cost);
      if (qty > 0 && cost > 0) return sum + qty * cost;
      return sum;
    }, 0);
  }, [lineItems]);

  const hasValidLineItem = useMemo(() => {
    return lineItems.some(
      (l) =>
        l.ingredient_id &&
        Number(l.quantity) > 0 &&
        l.unit &&
        Number(l.unit_cost) > 0,
    );
  }, [lineItems]);

  const hasIngredientSet = useMemo(() => {
    return lineItems.some((l) => l.ingredient_id);
  }, [lineItems]);

  const canSubmit = vendorId && effectiveZoneId && hasValidLineItem;

  const handleAddItem = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      { ingredient_id: '', quantity: '', unit: '', unit_cost: '' },
    ]);
  }, []);

  const handleUpdateLine = useCallback(
    (index: number, field: string, value: string) => {
      setLineItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    [],
  );

  const handleRemoveLine = useCallback((index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/purchase-orders', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order created.');
      router.push('/operations/purchase-orders');
    },
    onError: () =>
      toast.error(
        'Failed to save purchase order. Check that a vendor is selected and at least one item is added.',
      ),
  });

  const handleSubmit = (saveAsOrdered: boolean) => {
    if (!canSubmit) return;

    const payload = {
      vendor_id: vendorId,
      zone_id: effectiveZoneId,
      notes: notes || undefined,
      status: saveAsOrdered ? 'ordered' : 'draft',
      lines: lineItems
        .filter((l) => l.ingredient_id)
        .map((l) => ({
          ingredient_id: l.ingredient_id,
          quantity: Number(l.quantity),
          unit: l.unit,
          unit_cost: Number(l.unit_cost),
        })),
    };

    mutation.mutate(payload);
  };

  return (
      <div className="space-y-8 max-w-4xl">
        {/* Back link */}
        <button
          type="button"
          onClick={() => router.push('/operations/purchase-orders')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Purchase Orders
        </button>

        <h1 className="text-2xl font-bold">New Purchase Order</h1>

        {/* Section 1: Vendor + Zone Selection */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Vendor</label>
              <Select
                value={vendorId}
                onValueChange={(v) => setVendorId(v ?? '')}
              >
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue placeholder="Choose a vendor">
                    {(value: string) => {
                      if (!value) return 'Choose a vendor';
                      return vendors.find(v => v.id === value)?.name ?? 'Choose a vendor';
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeVendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Zone</label>
              <Select
                value={effectiveZoneId}
                onValueChange={(v) => setZoneId(v ?? '')}
              >
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue placeholder="Choose a zone">
                    {(value: string) => {
                      if (!value) return 'Choose a zone';
                      return zones.find(z => z.id === value)?.name ?? 'Choose a zone';
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vendor preview */}
          {selectedVendor && (
            <div className="rounded-lg border p-4 bg-muted/20">
              <p className="text-sm font-medium">{selectedVendor.name}</p>
              <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                {selectedVendor.phone && <span>{selectedVendor.phone}</span>}
                {selectedVendor.email && <span>{selectedVendor.email}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Line Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Order Items</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="h-8 text-xs"
            >
              <Plus className="size-3.5 mr-1" />
              Add Item
            </Button>
          </div>

          <div className="relative rounded-lg border overflow-hidden">
            {hasIngredientSet && <BorderBeam size={150} duration={8} />}

            <div className="p-4 space-y-0">
              {/* Column headers */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 pb-2 border-b border-border">
                {[
                  'Ingredient',
                  'Qty',
                  'Unit',
                  'Unit Cost (INR)',
                  'Line Total',
                  '',
                ].map((h, i) => (
                  <span
                    key={i}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {h}
                  </span>
                ))}
              </div>

              {lineItems.map((line, idx) => (
                <PurchaseOrderLineRow
                  key={idx}
                  line={line}
                  index={idx}
                  ingredients={ingredients}
                  onUpdate={handleUpdateLine}
                  onRemove={handleRemoveLine}
                />
              ))}

              {lineItems.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No items added. Click &quot;Add Item&quot; to begin.
                </div>
              )}
            </div>

            {/* Running total footer */}
            <div className="border-t px-4 py-3 flex items-center justify-end gap-3 bg-muted/20">
              <span className="text-sm font-medium">Total</span>
              <span className="font-mono text-lg font-semibold">
                INR{' '}
                <NumberTicker value={grandTotal} decimalPlaces={2} />
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Notes + Actions */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              placeholder="Add any notes for this purchase order..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={!canSubmit || mutation.isPending}
            >
              {mutation.isPending ? 'Saving...' : 'Save as Draft'}
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={!canSubmit || mutation.isPending}
            >
              {mutation.isPending ? 'Saving...' : 'Save and Mark as Ordered'}
            </Button>
          </div>
        </div>
      </div>
  );
}
