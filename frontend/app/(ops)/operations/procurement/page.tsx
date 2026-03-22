'use client';

import Link from 'next/link';
import { ShoppingCart, AlertTriangle, TrendingUp, PackageSearch } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { MagicCard } from '@/components/ui/magic-card';
import { NumberTicker } from '@/components/ui/number-ticker';
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
  const { data: summary, isLoading } = useQuery({
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
              <div key={i} className="rounded-xl border p-4 space-y-2 animate-pulse">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-6 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SUMMARY_CARDS.map((card, index) => {
              const value = Number(summary[card.key]) || 0;
              const showAmber = card.amberWhen && value > 0;
              return (
                <MagicCard key={card.key} gradientColor="#1a1a2e" className="rounded-xl">
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <card.icon className="size-4" />
                        <span className="text-xs font-medium">{card.label}</span>
                      </div>
                      <div className={`text-2xl font-semibold ${card.isCurrency ? 'font-mono' : ''} ${showAmber ? 'text-amber-500' : ''}`}>
                        {card.isCurrency ? (
                          <span className="font-mono">{formatINR(value)}</span>
                        ) : (
                          <NumberTicker value={value} />
                        )}
                      </div>
                    </div>
                  </MagicCard>
              );
            })}
          </div>
        )}

        {/* Top Vendors by Spend */}
        {summary && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Top Vendors by Spend</h2>
            {summary.top_vendors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vendor spend this month.</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full">
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
                  <MagicCard key={item.id} gradientColor="#1a1a2e" className="rounded-xl">
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium leading-tight">{item.ingredient?.name}</p>
                          <p className="text-xs text-muted-foreground">{item.zone?.name}</p>
                        </div>
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs border-0 bg-amber-500/15 text-amber-500 font-medium">
                          Low Stock
                        </span>
                      </div>
                      <p className="font-mono text-sm text-amber-500">
                        {item.current_quantity} / {item.ingredient?.min_stock_level} {item.ingredient?.base_unit}
                      </p>
                    </div>
                  </MagicCard>
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
