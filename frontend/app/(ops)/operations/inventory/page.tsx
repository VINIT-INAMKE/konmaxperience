'use client';

import { useState, useMemo } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InventoryRow } from '@/components/ops/operations/inventory/InventoryRow';
import { StockAdjustmentSheet } from '@/components/ops/operations/inventory/StockAdjustmentSheet';
import { apiClient } from '@/lib/api-client';
import type { IngredientStock } from '@/lib/types/inventory';
import type { IngredientCategory } from '@/lib/types/ingredient';
import { INGREDIENT_CATEGORIES, INGREDIENT_CATEGORY_LABELS } from '@/lib/types/ingredient';

interface Zone {
  id: string;
  name: string;
}

export default function InventoryPage() {
  const [categoryFilter, setCategoryFilter] = useState<IngredientCategory | 'all'>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);

  const { data: stocks, isLoading, isError } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiClient.get<IngredientStock[]>('/inventory'),
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });

  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    let result = stocks;

    if (categoryFilter !== 'all') {
      result = result.filter((s) => s.ingredient?.category === categoryFilter);
    }
    if (zoneFilter !== 'all') {
      result = result.filter((s) => s.zone_id === zoneFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.ingredient?.name?.toLowerCase().includes(query),
      );
    }
    return result;
  }, [stocks, categoryFilter, zoneFilter, searchQuery]);

  const lowStockCount = useMemo(() => {
    if (!stocks) return 0;
    return stocks.filter(
      (s) => Number(s.current_quantity) < Number(s.ingredient?.min_stock_level ?? 0),
    ).length;
  }, [stocks]);

  return (
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Inventory</h1>
          <Button variant="secondary" onClick={() => setAdjustOpen(true)}>
            Adjust Stock
          </Button>
        </div>

        {/* Low-stock alert strip */}
        {lowStockCount > 0 && (
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="size-4 text-amber-500" />
            <AlertDescription className="text-amber-500">
              {lowStockCount} ingredient{lowStockCount !== 1 ? 's' : ''} below minimum stock level. Review and reorder.
            </AlertDescription>
          </Alert>
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter((v ?? 'all') as IngredientCategory | 'all')}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {INGREDIENT_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {INGREDIENT_CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={zoneFilter}
            onValueChange={(v) => setZoneFilter(v ?? 'all')}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones?.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading inventory...</div>
        )}
        {isError && (
          <div className="text-sm text-destructive">
            Something went wrong. Refresh the page or try again in a moment.
          </div>
        )}

        {!isLoading && !isError && filteredStocks.length === 0 && (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              No ingredients found. Add ingredients first in the Ingredients section.
            </p>
          </div>
        )}

        {!isLoading && !isError && filteredStocks.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Zone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Min Level
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.map((stock) => (
                  <InventoryRow key={stock.id} stock={stock} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Stock adjustment Sheet */}
        <StockAdjustmentSheet open={adjustOpen} onOpenChange={setAdjustOpen} />
      </div>
  );
}
