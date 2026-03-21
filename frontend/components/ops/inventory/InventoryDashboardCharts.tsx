'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InventoryDashboardChartsProps {
  poBreakdown: { draft: number; ordered: number; received: number };
  topVendors: Array<{ vendor_id: string; vendor_name: string; spend: number }>;
}

const statusConfig = [
  { key: 'draft' as const, label: 'Draft', color: 'bg-muted-foreground/20' },
  { key: 'ordered' as const, label: 'Ordered', color: 'bg-amber-500/40' },
  { key: 'received' as const, label: 'Received', color: 'bg-emerald-500/40' },
];

export function InventoryDashboardCharts({ poBreakdown, topVendors }: InventoryDashboardChartsProps) {
  const totalPOs = poBreakdown.draft + poBreakdown.ordered + poBreakdown.received;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* PO Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">PO Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalPOs === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No purchase orders</p>
          ) : (
            statusConfig.map((status) => {
              const count = poBreakdown[status.key];
              const pct = totalPOs > 0 ? (count / totalPOs) * 100 : 0;

              return (
                <div key={status.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{status.label}</span>
                    <span className="font-mono font-bold text-sm">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${status.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Top Vendors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Top Vendors</CardTitle>
        </CardHeader>
        <CardContent>
          {topVendors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No vendor spend data</p>
          ) : (
            <div className="space-y-3">
              {topVendors.slice(0, 5).map((vendor, i) => (
                <div key={vendor.vendor_id} className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted-foreground w-4">{i + 1}</span>
                  <span className="text-sm flex-1 truncate">{vendor.vendor_name}</span>
                  <span className="font-mono font-bold text-sm">
                    ₹{vendor.spend.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
