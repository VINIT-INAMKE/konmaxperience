'use client';

import { NumberTicker } from '@/components/ui/number-ticker';
import type { DailySummary } from '@/lib/types/orders';

interface DailyRevenueSummaryProps {
  summary: DailySummary | undefined;
  isLoading: boolean;
}

function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function DailyRevenueSummary({ summary, isLoading }: DailyRevenueSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Orders Today */}
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-xs font-bold text-muted-foreground">Orders Today</p>
        <p className="text-[28px] font-bold font-mono leading-[1.1] mt-1">
          {isLoading ? (
            <span className="text-muted-foreground">--</span>
          ) : (
            <NumberTicker value={summary?.total_orders ?? 0} />
          )}
        </p>
      </div>

      {/* Revenue Today */}
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-xs font-bold text-muted-foreground">Revenue Today</p>
        <p className="text-[28px] font-bold font-mono leading-[1.1] mt-1">
          {isLoading ? (
            <span className="text-muted-foreground">--</span>
          ) : (
            <>
              <span className="text-base font-bold mr-0.5">&#8377;</span>
              <NumberTicker value={summary?.total_revenue ?? 0} />
            </>
          )}
        </p>
      </div>

      {/* Avg Order Value */}
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-xs font-bold text-muted-foreground">Avg Order Value</p>
        <p className="text-[28px] font-bold font-mono leading-[1.1] mt-1">
          {isLoading ? (
            <span className="text-muted-foreground">--</span>
          ) : (
            <>
              <span className="text-base font-bold mr-0.5">&#8377;</span>
              <NumberTicker value={summary?.average_order_value ?? 0} />
            </>
          )}
        </p>
      </div>
    </div>
  );
}
