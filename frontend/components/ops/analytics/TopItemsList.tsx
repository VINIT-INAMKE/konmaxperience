'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TopItem } from '@/lib/types/analytics';

interface TopItemsListProps {
  data: TopItem[];
}

export function TopItemsList({ data }: TopItemsListProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold">Top Selling Items</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No sales data for this period.
          </p>
        ) : (
          <div className="space-y-3">
            {data.slice(0, 10).map((item, i) => (
              <div key={item.product_id} className="flex items-center gap-3">
                <span className="font-mono text-sm text-muted-foreground w-6 text-right">
                  {i + 1}
                </span>
                <span className="text-sm flex-1 truncate">{item.name}</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {item.quantity_sold} sold
                </span>
                <span className="font-mono font-bold text-sm">
                  ₹{item.revenue.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
