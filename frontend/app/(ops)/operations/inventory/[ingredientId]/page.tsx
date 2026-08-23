'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StockMovementRow } from '@/components/ops/operations/inventory/StockMovementRow';
import { StockAdjustmentSheet } from '@/components/ops/operations/inventory/StockAdjustmentSheet';
import { apiClient } from '@/lib/api-client';
import type { IngredientStock, StockMovement } from '@/lib/types/inventory';

export default function IngredientMovementsPage() {
  const params = useParams();
  const ingredientId = params.ingredientId as string;
  const [adjustOpen, setAdjustOpen] = useState(false);

  const { data: stocks } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiClient.get<IngredientStock[]>('/inventory'),
  });
  const stock = stocks?.find((s) => s.ingredient_id === ingredientId);

  const {
    data: movements,
    isLoading: movementsLoading,
    isError: movementsError,
    refetch: refetchMovements,
  } = useQuery({
    queryKey: ['inventory', ingredientId, 'movements'],
    queryFn: () => apiClient.get<StockMovement[]>(`/inventory/${ingredientId}/movements`),
  });

  const ingredientName = stock?.ingredient?.name ?? 'Ingredient';
  const baseUnit = stock?.ingredient?.base_unit ?? '';
  const lastUpdated = stock?.updated_at
    ? new Date(stock.updated_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '\u2014';

  return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/operations/inventory"
            className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-3.5" />
            Inventory
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{ingredientName}</span>
        </div>

        {/* Summary card */}
        <Card className="p-6">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold">{ingredientName}</h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Current Stock: </span>
                <span className="font-mono font-medium">
                  {stock ? Number(stock.current_quantity) : '\u2014'} {baseUnit}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Zone: </span>
                <span>{stock?.zone?.name ?? '\u2014'}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3.5" />
                <span>Last updated: {lastUpdated}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Movements header */}
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Stock Movements</h2>
          <Button variant="secondary" onClick={() => setAdjustOpen(true)}>
            Manual Adjustment
          </Button>
        </div>

        {/* Movement list */}
        {movementsLoading && (
          <div className="rounded-lg border divide-y" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32 ml-auto" />
              </div>
            ))}
          </div>
        )}

        {movementsError && !movementsLoading && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Could not load stock movements</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              The movement history for this ingredient failed to load.
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetchMovements()}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!movementsLoading && !movementsError && (!movements || movements.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <ArrowUpDown className="size-12 text-ink-faint" />
            <h2 className="text-lg font-semibold">No Movements Yet</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              No stock movements recorded yet. Stock updates automatically when purchase orders are received.
            </p>
            <Button variant="outline" onClick={() => setAdjustOpen(true)}>
              Record a manual adjustment
            </Button>
          </div>
        )}

        {!movementsLoading && !movementsError && movements && movements.length > 0 && (
          <ScrollArea className="max-h-[600px] rounded-lg border">
            <div className="overflow-x-auto">
              {movements.map((movement) => (
                <StockMovementRow
                  key={movement.id}
                  movement={movement}
                  baseUnit={baseUnit}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Stock adjustment Sheet */}
        <StockAdjustmentSheet open={adjustOpen} onOpenChange={setAdjustOpen} />
      </div>
  );
}
