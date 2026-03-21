'use client';

import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';

interface Recipe {
  id: string;
  name: string;
  status: string;
}

interface Zone {
  id: string;
  name: string;
}

interface PrepBatchWizardStep1Props {
  recipeId: string;
  setRecipeId: (id: string) => void;
  quantity: string;
  setQuantity: (qty: string) => void;
  zoneId: string;
  setZoneId: (id: string) => void;
  onNext: () => void;
}

export function PrepBatchWizardStep1({
  recipeId,
  setRecipeId,
  quantity,
  setQuantity,
  zoneId,
  setZoneId,
  onNext,
}: PrepBatchWizardStep1Props) {
  const { data: recipes } = useQuery({
    queryKey: ['recipes', 'approved'],
    queryFn: () => apiClient.get<Recipe[]>('/recipes?status=approved'),
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });

  const canProceed = recipeId && Number(quantity) > 0 && zoneId;

  return (
    <div className="space-y-4">
      {/* Recipe select */}
      <div className="space-y-2">
        <Label>Recipe</Label>
        <Select
          value={recipeId}
          onValueChange={(v) => setRecipeId(v ?? '')}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select recipe" />
          </SelectTrigger>
          <SelectContent>
            {recipes?.map((recipe) => (
              <SelectItem key={recipe.id} value={recipe.id}>
                {recipe.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quantity input */}
      <div className="space-y-2">
        <Label htmlFor="prep-quantity">Quantity</Label>
        <Input
          id="prep-quantity"
          type="number"
          step="0.001"
          min="0.001"
          placeholder="e.g. 5"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="font-mono"
        />
      </div>

      {/* Zone select */}
      <div className="space-y-2">
        <Label>Zone</Label>
        <Select
          value={zoneId}
          onValueChange={(v) => setZoneId(v ?? '')}
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

      {/* Next button */}
      <div className="pt-2">
        <Button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
