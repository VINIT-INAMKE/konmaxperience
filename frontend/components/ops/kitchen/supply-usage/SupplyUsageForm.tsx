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

interface SupplyIngredient {
  id: string;
  name: string;
  base_unit: string;
}

interface Zone {
  id: string;
  name: string;
}

interface SupplyUsageFormProps {
  onSuccess: () => void;
}

export function SupplyUsageForm({ onSuccess }: SupplyUsageFormProps) {
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [notes, setNotes] = useState('');

  const { data: supplies } = useQuery({
    queryKey: ['ingredients', 'supply'],
    queryFn: () =>
      apiClient.get<SupplyIngredient[]>('/ingredients?usage_type=supply'),
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });

  const selectedSupply = supplies?.find((s) => s.id === ingredientId);

  const resetForm = () => {
    setIngredientId('');
    setQuantity('');
    setUnit('');
    setZoneId('');
    setNotes('');
  };

  const mutation = useMutation({
    mutationFn: (data: {
      ingredient_id: string;
      quantity: number;
      unit: string;
      zone_id: string;
      notes: string | null;
    }) => apiClient.post('/kitchen/supply-usage', data),
    onSuccess: () => {
      toast.success('Supply usage logged.');
      onSuccess();
      resetForm();
    },
    onError: () => {
      toast.error('Failed to log supply usage. Try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientId || !quantity || !unit || !zoneId) return;

    mutation.mutate({
      ingredient_id: ingredientId,
      quantity: Number(quantity),
      unit,
      zone_id: zoneId,
      notes: notes.trim() || null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Supply selector */}
          <div className="space-y-2">
            <Label>Supply</Label>
            <Select
              value={ingredientId}
              onValueChange={(v) => {
                setIngredientId(v ?? '');
                const supply = supplies?.find((s) => s.id === v);
                if (supply) setUnit(supply.base_unit);
              }}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select supply">
                  {(value: string) => {
                    if (!value) return 'Select supply';
                    const supply = supplies?.find((s) => s.id === value);
                    return supply ? `${supply.name} (${supply.base_unit})` : 'Select supply';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {supplies?.map((supply) => (
                  <SelectItem key={supply.id} value={supply.id}>
                    {supply.name} ({supply.base_unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity + Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="supply-qty">Quantity</Label>
              <Input
                id="supply-qty"
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
              <Label htmlFor="supply-unit">Unit</Label>
              <Input
                id="supply-unit"
                placeholder={selectedSupply?.base_unit ?? 'e.g. pcs'}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                disabled={mutation.isPending}
              />
            </div>
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
                <SelectValue placeholder="Select zone">
                  {(value: string) => {
                    if (!value) return 'Select zone';
                    return zones?.find((z) => z.id === value)?.name ?? 'Select zone';
                  }}
                </SelectValue>
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="supply-notes">Notes (optional)</Label>
            <Textarea
              id="supply-notes"
              placeholder="Additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={mutation.isPending}
              rows={2}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || !ingredientId || !quantity || !unit || !zoneId}
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                Logging...
              </span>
            ) : (
              'Log Usage'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
