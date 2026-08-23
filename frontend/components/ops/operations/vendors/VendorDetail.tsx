'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VendorPriceHistory } from './VendorPriceHistory';
import { VendorPriceForm } from './VendorPriceForm';
import { apiClient } from '@/lib/api-client';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { Vendor, VendorPrice } from '@/lib/types/vendor';

interface VendorDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: Vendor | null;
}

interface GroupedIngredient {
  ingredientId: string;
  ingredientName: string;
  prices: VendorPrice[];
}

function groupByIngredient(prices: VendorPrice[]): GroupedIngredient[] {
  const map = new Map<string, GroupedIngredient>();

  for (const price of prices) {
    const id = price.ingredient_id;
    if (!map.has(id)) {
      map.set(id, {
        ingredientId: id,
        ingredientName: price.ingredient?.name ?? 'Unknown Ingredient',
        prices: [],
      });
    }
    map.get(id)!.prices.push(price);
  }

  // Sort prices DESC by effective_date within each group
  for (const group of map.values()) {
    group.prices.sort(
      (a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime(),
    );
  }

  return Array.from(map.values());
}

export function VendorDetail({ open, onOpenChange, vendor }: VendorDetailProps) {
  const [expandedIngredients, setExpandedIngredients] = useState<Set<string>>(new Set());
  const [priceFormOpen, setPriceFormOpen] = useState(false);

  const { data: vendorDetail } = useQuery({
    queryKey: ['vendor', vendor?.id],
    queryFn: () => apiClient.get<Vendor>(`/vendors/${vendor!.id}`),
    enabled: open && !!vendor?.id,
  });

  const allPrices = vendorDetail?.VendorPrices ?? [];
  const grouped = groupByIngredient(allPrices);

  const toggleIngredient = (ingredientId: string) => {
    setExpandedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) {
        next.delete(ingredientId);
      } else {
        next.add(ingredientId);
      }
      return next;
    });
  };

  if (!vendor) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[560px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{vendor.name}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 px-4 space-y-6">
            {/* Vendor info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    vendor.status === 'active' ? STATUS_BADGE.good : STATUS_BADGE.neutral
                  }
                >
                  {vendor.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
                {vendor.payment_terms && (
                  <Badge variant="outline" className="text-xs">
                    {vendor.payment_terms}
                  </Badge>
                )}
              </div>

              {(vendor.phone || vendor.email || vendor.address) && (
                <div className="text-sm text-muted-foreground space-y-1 pt-1">
                  {vendor.phone && (
                    <p>
                      <span className="font-medium text-foreground">Phone:</span> {vendor.phone}
                    </p>
                  )}
                  {vendor.email && (
                    <p>
                      <span className="font-medium text-foreground">Email:</span> {vendor.email}
                    </p>
                  )}
                  {vendor.address && (
                    <p>
                      <span className="font-medium text-foreground">Address:</span> {vendor.address}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Linked Ingredients & Prices */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Linked Ingredients & Prices</h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setPriceFormOpen(true)}
                >
                  <Plus className="size-3" />
                  Add Price
                </Button>
              </div>

              {grouped.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <p className="text-sm font-medium">No ingredients linked</p>
                  <p className="text-xs text-muted-foreground">
                    Add a price entry to link this vendor to an ingredient.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {grouped.map((group) => {
                    const isExpanded = expandedIngredients.has(group.ingredientId);
                    const currentPrice = group.prices[0];

                    return (
                      <div
                        key={group.ingredientId}
                        className="rounded-lg border overflow-hidden"
                      >
                        {/* Header row */}
                        <button
                          className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/30 transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-inset"
                          onClick={() => toggleIngredient(group.ingredientId)}
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="size-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-3.5 text-muted-foreground" />
                            )}
                            <span className="font-medium">{group.ingredientName}</span>
                          </div>
                          {currentPrice && (
                            <span className="text-xs text-muted-foreground font-mono">
                              ₹{Number(currentPrice.price).toFixed(2)}/{currentPrice.unit}
                            </span>
                          )}
                        </button>

                        {/* Expanded price history */}
                        {isExpanded && (
                          <div className="border-t px-2 py-2">
                            <VendorPriceHistory prices={group.prices} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Nested price form */}
      <VendorPriceForm
        open={priceFormOpen}
        onOpenChange={setPriceFormOpen}
        vendorId={vendor.id}
        onSuccess={() => setPriceFormOpen(false)}
      />
    </>
  );
}
