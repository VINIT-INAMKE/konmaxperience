'use client';

import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { apiClient } from '@/lib/api-client';
import { YIELD_UNITS, RECIPE_STATUSES, RECIPE_STATUS_LABELS } from '@/lib/types/recipe';
import type { RecipeStatus } from '@/lib/types/recipe';
import type { Brand } from '@/lib/types/brand';
import type { Zone } from '@/lib/types/zone';

export interface RecipeDetailsState {
  name: string;
  description: string;
  prep_steps: string;
  cooking_method: string;
  yield_qty: string;
  yield_unit: string;
  portion_size: string;
  shelf_life_hours: string;
  brand_id: string;
  zone_id: string;
  image_url: string;
  status: RecipeStatus | '';
}

interface RecipeWizardStep1Props {
  details: RecipeDetailsState;
  setDetails: (details: RecipeDetailsState) => void;
  onNext: () => void;
  isEditMode: boolean;
}

export function RecipeWizardStep1({
  details,
  setDetails,
  onNext,
  isEditMode,
}: RecipeWizardStep1Props) {
  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: () => apiClient.get<Brand[]>('/brands'),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });

  const canProceed = details.name.trim() !== '' && details.yield_qty.trim() !== '';

  const update = (field: keyof RecipeDetailsState, value: string) => {
    setDetails({ ...details, [field]: value });
  };

  // Filter out 'draft' when currently approved in edit mode
  const availableStatuses = isEditMode && details.status === 'approved'
    ? RECIPE_STATUSES.filter((s) => s !== 'draft')
    : RECIPE_STATUSES;

  return (
    <div className="space-y-4 overflow-y-auto">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="recipe-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="recipe-name"
          placeholder="e.g. Masala Chai"
          value={details.name}
          onChange={(e) => update('name', e.target.value)}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="recipe-description">Description</Label>
        <Textarea
          id="recipe-description"
          rows={3}
          placeholder="Brief description of the dish..."
          value={details.description}
          onChange={(e) => update('description', e.target.value)}
        />
      </div>

      {/* Prep Steps */}
      <div className="space-y-2">
        <Label htmlFor="recipe-prep-steps">Prep Steps</Label>
        <Textarea
          id="recipe-prep-steps"
          rows={5}
          placeholder={"1. Marinate chicken for 2 hours\n2. Heat pan to medium-high..."}
          value={details.prep_steps}
          onChange={(e) => update('prep_steps', e.target.value)}
        />
      </div>

      {/* Cooking Method */}
      <div className="space-y-2">
        <Label htmlFor="recipe-cooking-method">Cooking Method</Label>
        <Input
          id="recipe-cooking-method"
          placeholder="e.g. Stir fry, Slow cook, Bake..."
          value={details.cooking_method}
          onChange={(e) => update('cooking_method', e.target.value)}
        />
      </div>

      {/* Yield Qty + Yield Unit */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="recipe-yield-qty">
            Yield Qty <span className="text-destructive">*</span>
          </Label>
          <Input
            id="recipe-yield-qty"
            type="number"
            min="0.001"
            step="any"
            placeholder="e.g. 500"
            value={details.yield_qty}
            onChange={(e) => update('yield_qty', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Yield Unit</Label>
          <Select
            value={details.yield_unit}
            onValueChange={(v) => update('yield_unit', v ?? 'g')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              {YIELD_UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Portion Size */}
      <div className="space-y-2">
        <Label htmlFor="recipe-portion-size">Portion Size</Label>
        <Input
          id="recipe-portion-size"
          placeholder="e.g. 200ml, 1 piece"
          value={details.portion_size}
          onChange={(e) => update('portion_size', e.target.value)}
        />
      </div>

      {/* Shelf Life Hours */}
      <div className="space-y-2">
        <Label htmlFor="recipe-shelf-life">Shelf Life (hours)</Label>
        <Input
          id="recipe-shelf-life"
          type="number"
          min="0"
          placeholder="48"
          value={details.shelf_life_hours}
          onChange={(e) => update('shelf_life_hours', e.target.value)}
        />
      </div>

      {/* Brand */}
      <div className="space-y-2">
        <Label>Brand</Label>
        <Select
          value={details.brand_id}
          onValueChange={(v) => update('brand_id', v ?? '')}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select brand (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Zone */}
      <div className="space-y-2">
        <Label>Zone</Label>
        <Select
          value={details.zone_id}
          onValueChange={(v) => update('zone_id', v ?? '')}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select zone (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {zones.map((zone) => (
              <SelectItem key={zone.id} value={zone.id}>
                {zone.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Image URL */}
      <div className="space-y-2">
        <Label htmlFor="recipe-image-url">Image URL (optional)</Label>
        <Input
          id="recipe-image-url"
          type="url"
          placeholder="https://..."
          value={details.image_url}
          onChange={(e) => update('image_url', e.target.value)}
        />
      </div>

      {/* Status (edit mode only) */}
      {isEditMode && (
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={details.status}
            onValueChange={(v) => update('status', v as RecipeStatus)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {availableStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {RECIPE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* CTA */}
      <div className="pt-2">
        <ShimmerButton
          shimmerColor="#4ade80"
          className="h-9 text-sm px-4"
          disabled={!canProceed}
          onClick={onNext}
          type="button"
        >
          Next: Add Ingredients
        </ShimmerButton>
      </div>
    </div>
  );
}
