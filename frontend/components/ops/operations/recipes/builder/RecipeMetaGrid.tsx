'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UtensilsCrossed, Package, ShoppingBag, Layers } from 'lucide-react';
import {
  YIELD_UNITS,
  PREPARATION_TYPES,
  PREPARATION_TYPE_LABELS,
  PREPARATION_TYPE_DESCRIPTIONS,
  type PreparationType,
} from '@/lib/types/recipe';

interface RecipeMetaGridProps {
  brandId: string | null;
  zoneId: string | null;
  yieldQty: string;
  yieldUnit: string;
  portionSize: string;
  shelfLifeHours: string;
  description: string;
  preparationType: PreparationType;
  brands: Array<{ id: string; name: string }>;
  zones: Array<{ id: string; name: string }>;
  isLocked: boolean;
  onChange: (field: string, value: string) => void;
}

const PREP_TYPE_ICONS: Record<PreparationType, React.ReactNode> = {
  scratch: <UtensilsCrossed className="size-4" />,
  batch_prepared: <Package className="size-4" />,
  ready_to_sell: <ShoppingBag className="size-4" />,
  assemble: <Layers className="size-4" />,
};

export function RecipeMetaGrid({
  brandId,
  zoneId,
  yieldQty,
  yieldUnit,
  portionSize,
  shelfLifeHours,
  description,
  preparationType,
  brands,
  zones,
  isLocked,
  onChange,
}: RecipeMetaGridProps) {
  return (
    <div className="space-y-4">
      {/* Preparation Type selector -- full width row */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground uppercase tracking-wide font-normal">
          Preparation Type
        </label>
        <RadioGroup
          value={preparationType}
          onValueChange={(v) => onChange('preparationType', v as string)}
          disabled={isLocked}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {PREPARATION_TYPES.map((type) => {
            const isSelected = preparationType === type;
            return (
              <label
                key={type}
                className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-3 min-h-[48px] cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-foreground font-medium'
                    : 'border-border bg-transparent text-muted-foreground'
                } ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <RadioGroupItem value={type} className="sr-only" />
                {PREP_TYPE_ICONS[type]}
                <span className="text-sm">{PREPARATION_TYPE_LABELS[type]}</span>
                <span className="text-xs text-muted-foreground">{PREPARATION_TYPE_DESCRIPTIONS[type]}</span>
              </label>
            );
          })}
        </RadioGroup>
        {preparationType === 'ready_to_sell' && (
          <p className="text-xs text-amber-500 mt-1">
            Prep steps and cooking method are optional for shelf items.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
        {/* Brand */}
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wide font-normal">
            Brand
          </label>
          <Select
            value={brandId ?? ''}
            onValueChange={(v) => onChange('brandId', v ?? '')}
            disabled={isLocked}
          >
            <SelectTrigger className="h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-[var(--primary)] transition-colors truncate">
              <SelectValue placeholder="Select brand">
                {(value: string) => {
                  if (!value) return 'Select brand';
                  return brands.find((b) => b.id === value)?.name ?? 'Select brand';
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Zone */}
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wide font-normal">
            Zone
          </label>
          <Select
            value={zoneId ?? ''}
            onValueChange={(v) => onChange('zoneId', v ?? '')}
            disabled={isLocked}
          >
            <SelectTrigger className="h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-[var(--primary)] transition-colors truncate">
              <SelectValue placeholder="Select zone">
                {(value: string) => {
                  if (!value) return 'Select zone';
                  return zones.find((z) => z.id === value)?.name ?? 'Select zone';
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {zones.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Yield Qty */}
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wide font-normal">
            Yield Qty
          </label>
          <Input
            className="h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-[var(--primary)] transition-colors"
            value={yieldQty}
            onChange={(e) => onChange('yieldQty', e.target.value)}
            disabled={isLocked}
            placeholder="0"
            type="number"
            min="0"
          />
        </div>

        {/* Yield Unit */}
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wide font-normal">
            Yield Unit
          </label>
          <Select
            value={yieldUnit}
            onValueChange={(v) => onChange('yieldUnit', v ?? '')}
            disabled={isLocked}
          >
            <SelectTrigger className="h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-[var(--primary)] transition-colors">
              <SelectValue placeholder="Select unit" />
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

        {/* Portion Size */}
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wide font-normal">
            Portion Size
          </label>
          <Input
            className="h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-[var(--primary)] transition-colors"
            value={portionSize}
            onChange={(e) => onChange('portionSize', e.target.value)}
            disabled={isLocked}
            placeholder="e.g. 250g"
          />
        </div>

        {/* Shelf Life */}
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wide font-normal">
            Shelf Life (hrs)
          </label>
          <Input
            className="h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-[var(--primary)] transition-colors"
            value={shelfLifeHours}
            onChange={(e) => onChange('shelfLifeHours', e.target.value)}
            disabled={isLocked}
            placeholder="0"
            type="number"
            min="0"
          />
        </div>
      </div>

      {/* Description — full width */}
      <div className="flex flex-col gap-0.5">
        <label className="text-xs text-muted-foreground uppercase tracking-wide font-normal">
          Description
        </label>
        <textarea
          className="w-full text-sm bg-transparent border border-transparent hover:border-border focus:border-[var(--primary)] outline-none transition-colors rounded-md p-2 min-h-[56px] resize-y disabled:pointer-events-none disabled:opacity-50"
          value={description}
          onChange={(e) => onChange('description', e.target.value)}
          disabled={isLocked}
          placeholder="Brief recipe description..."
          rows={2}
        />
      </div>
    </div>
  );
}
