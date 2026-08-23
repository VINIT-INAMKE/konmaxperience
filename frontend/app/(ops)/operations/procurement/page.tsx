'use client';

import Link from 'next/link';
import { ShoppingCart, AlertTriangle, TrendingUp, PackageSearch } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NumberTicker } from '@/components/ui/number-ticker';
import { STATUS_BADGE } from '@/lib/status-styles';
import { apiClient } from '@/lib/api-client';
import type { IngredientStock } from '@/lib/types/inventory';

interface ProcurementSummary {
  pending_po_count: number;
  low_stock_count: number;
  vendor_spend_this_month: number;
  total_inventory_value: number;
  top_vendors: { vendor_name: string; total_spend: number }[];
}

const SUMMARY_CARDS = [
  {
    label: 'Pending Orders',
    key: 'pending_po_count' as const,
    icon: ShoppingCart,
    isCurrency: false,
    amberWhen: false,
  },
  {
    label: 'Low Stock Items',
    key: 'low_stock_count' as const,
    icon: AlertTriangle,
    isCurrency: false,
    amberWhen: true,
  },
  {
    label: 'Vendor Spend This Month',
    key: 'vendor_spend_this_month' as const,
    icon: TrendingUp,
    isCurrency: true,
    amberWhen: false,
  },
  {
    label: 'Total Inventory Value',
    key: 'total_inventory_value' as const,
    icon: PackageSearch,
    isCurrency: true,
    amberWhen: false,
  },
] as const;

function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProcurementPage() {
  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['procurement-summary'],
    queryFn: () => apiClient.get<ProcurementSummary>('/procurement/summary'),
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => apiClient.get<IngredientStock[]>('/inventory/low-stock'),
    enabled: !!summary?.low_stock_count,
  });

  return (
      <div className="space-y-8">
        {/* Page header */}
        <h1 className="text-2xl font-bold">Procurement</h1>

        {/* Summary cards */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border p-4 space-y-2 animate-pulse motion-reduce:animate-none">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-6 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Could not load procurement summary</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              Pending orders, spend and low-stock counts are unavailable right now.
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SUMMARY_CARDS.map((card) => {
              const value = Number(summary[card.key]) || 0;
              const showWarning = card.amberWhen && value > 0;
              return (
                <Card key={card.key}>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <card.icon className="size-4" />
                        <span className="text-xs font-medium">{card.label}</span>
                      </div>
                      <div className={`text-2xl font-semibold ${card.isCurrency ? 'font-mono' : ''} ${showWarning ? 'text-[var(--status-warning)]' : ''}`}>
                        {card.isCurrency ? (
                          <span className="font-mono">{formatINR(value)}</span>
                        ) : (
                          <NumberTicker value={value} />
                        )}
                      </div>
                    </div>
                  </Card>
              );
            })}
          </div>
        )}

        {/* Top Vendors by Spend */}
        {summary && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Top Vendors by Spend</h2>
            {summary.top_vendors.length === 0 ? (
              <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-6">
                <p className="text-sm text-muted-foreground">
                  No vendor spend this month. Raise a purchase order to start tracking spend.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/operations/purchase-orders" />}
                >
                  Go to Purchase Orders
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full min-w-[420px]">
                  <thead className="bg-muted/40">
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Vendor
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Spend This Month (INR)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.top_vendors.slice(0, 3).map((vendor) => (
                      <tr key={vendor.vendor_name} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">{vendor.vendor_name}</td>
                        <td className="px-4 py-3 text-sm font-mono text-right text-muted-foreground">
                          {formatINR(vendor.total_spend)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Low Stock Alerts */}
        {summary && summary.low_stock_count > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Low Stock Alerts</h2>
            {lowStockItems && lowStockItems.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {lowStockItems.slice(0, 4).map((item) => (
                  <Card key={item.id}>
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium leading-tight">{item.ingredient?.name}</p>
                          <p className="text-xs text-muted-foreground">{item.zone?.name}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE.warning}`}>
                          Low Stock
                        </span>
                      </div>
                      <p className="font-mono text-sm text-[var(--status-warning)]">
                        {item.current_quantity} / {item.ingredient?.min_stock_level} {item.ingredient?.base_unit}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Link
                href="/operations/inventory"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View All Inventory
              </Link>
            </div>
          </div>
        )}
      </div>
  );
}
