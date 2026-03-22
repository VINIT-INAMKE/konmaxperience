'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import type { WasteType, WasteReason } from '@/lib/types/kitchen';
import { WASTE_TYPE_LABELS, WASTE_REASONS, WASTE_REASON_LABELS } from '@/lib/types/kitchen';
import type { PrepBatch } from '@/lib/types/kitchen';

interface Ingredient {
  id: string;
  name: string;
  base_unit: string;
}

interface Zone {
  id: string;
  name: string;
}

interface WasteLogResponse {
  id: string;
  cost_impact: number;
}

interface WasteLogFormProps {
  onSuccess: () => void;
}

export function WasteLogForm({ onSuccess }: WasteLogFormProps) {
  const [wasteType, setWasteType] = useState<WasteType>('ingredient');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [reason, setReason] = useState<WasteReason | ''>('');
  const [reasonNotes, setReasonNotes] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [lastCostImpact, setLastCostImpact] = useState<number | null>(null);

  const { data: ingredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => apiClient.get<Ingredient[]>('/ingredients'),
    enabled: wasteType === 'ingredient',
  });

  const { data: prepBatches } = useQuery({
    queryKey: ['prep-batches', 'active'],
    queryFn: () => apiClient.get<PrepBatch[]>('/kitchen/prep-batches?status=active'),
    enabled: wasteType === 'prep_batch',
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });

  // Get the unit hint based on selection
  const selectedIngredient = ingredients?.find((i) => i.id === itemId);
  const selectedBatch = prepBatches?.find((b) => b.id === itemId);
  const unitHint =
    wasteType === 'ingredient'
      ? selectedIngredient?.base_unit ?? ''
      : selectedBatch?.unit ?? '';

  const resetForm = () => {
    setItemId('');
    setQuantity('');
    setUnit('');
    setReason('');
    setReasonNotes('');
    setZoneId('');
  };

  const mutation = useMutation({
    mutationFn: (data: {
      waste_type: WasteType;
      ingredient_id?: string;
      prep_batch_id?: string;
      quantity: number;
      unit: string;
      reason: WasteReason;
      reason_notes: string | null;
      zone_id: string;
    }) => apiClient.post<WasteLogResponse>('/kitchen/waste', data),
    onSuccess: (data) => {
      setLastCostImpact(Number(data.cost_impact));
      toast.success('Waste entry logged.');
      onSuccess();
      resetForm();
    },
    onError: () => {
      toast.error('Failed to log waste. Try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !quantity || !unit || !reason || !zoneId) return;

    mutation.mutate({
      waste_type: wasteType,
      ...(wasteType === 'ingredient'
        ? { ingredient_id: itemId }
        : { prep_batch_id: itemId }),
      quantity: Number(quantity),
      unit,
      reason: reason as WasteReason,
      reason_notes: reasonNotes.trim() || null,
      zone_id: zoneId,
    });
  };

  const handleWasteTypeChange = (v: string | null) => {
    const newType = (v ?? 'ingredient') as WasteType;
    setWasteType(newType);
    setItemId('');
    setUnit('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Waste</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Waste Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={wasteType}
              onValueChange={handleWasteTypeChange}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ingredient">{WASTE_TYPE_LABELS.ingredient}</SelectItem>
                <SelectItem value="prep_batch">{WASTE_TYPE_LABELS.prep_batch}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Item (dynamic) */}
          <div className="space-y-2">
            <Label>Item</Label>
            <Select
              value={itemId}
              onValueChange={(v) => {
                setItemId(v ?? '');
                // Auto-set unit from item
                if (wasteType === 'ingredient') {
                  const ing = ingredients?.find((i) => i.id === v);
                  if (ing) setUnit(ing.base_unit);
                } else {
                  const batch = prepBatches?.find((b) => b.id === v);
                  if (batch) setUnit(batch.unit);
                }
              }}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {wasteType === 'ingredient'
                  ? ingredients?.map((ing) => (
                      <SelectItem key={ing.id} value={ing.id}>
                        {ing.name} ({ing.base_unit})
                      </SelectItem>
                    ))
                  : prepBatches?.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.recipe?.name ?? 'Batch'} &mdash; {batch.quantity_remaining} {batch.unit} remaining
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity + Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="waste-qty">Quantity</Label>
              <Input
                id="waste-qty"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-mono"
                required
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waste-unit">Unit</Label>
              <Input
                id="waste-unit"
                placeholder={unitHint || 'e.g. kg'}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                disabled={mutation.isPending}
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select
              value={reason}
              onValueChange={(v) => setReason((v ?? '') as WasteReason | '')}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {WASTE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {WASTE_REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="waste-notes">Notes (optional)</Label>
            <Textarea
              id="waste-notes"
              placeholder="Additional details..."
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              disabled={mutation.isPending}
              rows={2}
            />
          </div>

          {/* Zone */}
          <div className="space-y-2">
            <Label>Zone</Label>
            <Select
              value={zoneId}
              onValueChange={(v) => setZoneId(v ?? '')}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select zone" />
              </SelectTrigger>
              <SelectContent>
                {zones?.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || !itemId || !quantity || !unit || !reason || !zoneId}
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                Logging...
              </span>
            ) : (
              'Log Waste'
            )}
          </Button>

          {/* Cost impact display */}
          {lastCostImpact !== null && (
            <div className="rounded-md bg-muted/50 p-3 text-center">
              <span className="text-xs text-muted-foreground">Cost Impact</span>
              <p className="text-lg font-semibold font-mono">
                {new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                  minimumFractionDigits: 2,
                }).format(lastCostImpact)}
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
