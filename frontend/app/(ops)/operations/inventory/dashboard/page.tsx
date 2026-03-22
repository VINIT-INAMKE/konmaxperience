'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardLowStockAlert } from '@/components/ops/dashboard/DashboardLowStockAlert';
import { InventoryDashboardCharts } from '@/components/ops/inventory/InventoryDashboardCharts';
import { apiClient } from '@/lib/api-client';
import type { ProcurementSummary } from '@/lib/types/analytics';
import type { IngredientStock } from '@/lib/types/inventory';
import { Package, AlertTriangle, FileText, IndianRupee } from 'lucide-react';

export default function InventoryDashboardPage() {
  const {
    data: summary,
    isLoading: summaryLoading,
  } = useQuery({
    queryKey: ['procurement', 'summary'],
    queryFn: () => apiClient.get<ProcurementSummary>('/procurement/summary'),
  });

  const {
    data: lowStockItems,
    isLoading: lowStockLoading,
  } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => apiClient.get<IngredientStock[]>('/inventory/low-stock'),
  });

  const statCards = summary
    ? [
        {
          key: 'value',
          label: 'Inventory Value',
          icon: Package,
          value: Math.round(summary.total_inventory_value),
          prefix: '₹',
        },
        {
          key: 'low',
          label: 'Low Stock Items',
          icon: AlertTriangle,
          value: summary.low_stock_count,
          alert: summary.low_stock_count > 0,
        },
        {
          key: 'pos',
          label: 'Open POs',
          icon: FileText,
          value: summary.pending_po_count,
        },
        {
          key: 'spend',
          label: 'Total PO Value',
          icon: IndianRupee,
          value: Math.round(summary.vendor_spend_this_month),
          prefix: '₹',
        },
      ]
    : [];

  return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Inventory Overview</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryLoading
            ? [1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))
            : statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Card key={card.key}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-muted-foreground">{card.label}</span>
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <p
                        className={`mt-2 text-[28px] font-bold font-mono leading-tight ${
                          'alert' in card && card.alert ? 'text-destructive' : ''
                        }`}
                      >
                        {'prefix' in card && card.prefix}
                        <NumberTicker value={card.value} />
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
        </div>

        {/* Low stock alerts */}
        {!lowStockLoading && lowStockItems && lowStockItems.length > 0 && (
          <DashboardLowStockAlert lowStockItems={lowStockItems} />
        )}

        {/* Charts section */}
        {summaryLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        ) : (
          summary && (
            <InventoryDashboardCharts
              poBreakdown={summary.po_status_breakdown}
              topVendors={summary.top_vendors}
            />
          )
        )}
      </div>
  );
}
