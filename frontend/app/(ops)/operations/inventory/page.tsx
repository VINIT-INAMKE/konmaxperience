'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, AlertTriangle, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InventoryRow } from '@/components/ops/operations/inventory/InventoryRow';
import { StockAdjustmentSheet } from '@/components/ops/operations/inventory/StockAdjustmentSheet';
import { apiClient } from '@/lib/api-client';
import type { IngredientStock } from '@/lib/types/inventory';
import type { IngredientCategoryItem } from '@/lib/types/ingredient';
import { ExportButton } from '@/components/ops/exports/ExportButton';

interface Zone {
  id: string;
  name: string;
}

export default function InventoryPage() {
  // 'all' or an IngredientCategory row id — categories are DB rows, not a fixed enum.
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);

  const { data: stocks, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiClient.get<IngredientStock[]>('/inventory'),
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });

  const { data: categories } = useQuery({
    queryKey: ['ingredient-categories'],
    queryFn: () => apiClient.get<IngredientCategoryItem[]>('/ingredient-categories'),
  });

  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    let result = stocks;

    if (categoryFilter !== 'all') {
      result = result.filter((s) => s.ingredient?.category_id === categoryFilter);
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
          <Alert className="border-[var(--status-warning)]/30 bg-[var(--status-warning)]/8 text-[var(--status-warning)]">
            <AlertTriangle className="size-4 text-[var(--status-warning)]" />
            <AlertDescription className="text-[var(--status-warning)]">
              {lowStockCount} ingredient{lowStockCount !== 1 ? 's' : ''} below minimum stock level. Review and reorder.
            </AlertDescription>
          </Alert>
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v ?? 'all')}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category">
                {(value: string) => {
                  if (!value || value === 'all') return 'All Categories';
                  return categories?.find((c) => c.id === value)?.name ?? 'All Categories';
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {(categories ?? []).map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={zoneFilter}
            onValueChange={(v) => setZoneFilter(v ?? 'all')}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Zone">
                {(value: string) => {
                  if (!value || value === 'all') return 'All Zones';
                  return zones?.find(z => z.id === value)?.name ?? 'All Zones';
                }}
              </SelectValue>
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
          <ExportButton
            reportType="inventory_levels"
            reportName="Inventory Levels"
            isTimeSeries={false}
          />
        </div>

        {/* Table */}
        {isLoading && (
          <div className="rounded-lg border divide-y" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20 ml-auto" />
              </div>
            ))}
          </div>
        )}
        {isError && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Could not load inventory</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              Something went wrong while fetching stock levels.
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && filteredStocks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <Package className="size-12 text-ink-faint" />
            <h2 className="text-lg font-semibold">No Inventory Data</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              No ingredients found. Add ingredients first in the Ingredients section.
            </p>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/operations/ingredients" />}
            >
              Go to Ingredients
            </Button>
          </div>
        )}

        {!isLoading && !isError && filteredStocks.length > 0 && (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full min-w-[720px]">
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
