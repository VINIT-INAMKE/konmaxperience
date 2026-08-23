'use client';

import type { DailySummary } from '@/lib/types/orders';

interface DailyRevenueSummaryProps {
  summary: DailySummary | undefined;
  isLoading: boolean;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-IN');
}

export function DailyRevenueSummary({ summary, isLoading }: DailyRevenueSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Orders Today */}
      <div className="bg-card border border-line rounded-lg p-4">
        <p className="text-xs font-bold text-ink-muted">Orders Today</p>
        <p className="text-[28px] font-bold font-mono leading-[1.1] mt-1 tabular-nums">
          {isLoading ? (
            <span className="text-ink-muted">--</span>
          ) : (
            formatCount(summary?.total_orders ?? 0)
          )}
        </p>
      </div>

      {/* Revenue Today */}
      <div className="bg-card border border-line rounded-lg p-4">
        <p className="text-xs font-bold text-ink-muted">Revenue Today</p>
        <p className="text-[28px] font-bold font-mono leading-[1.1] mt-1 tabular-nums">
          {isLoading ? (
            <span className="text-ink-muted">--</span>
          ) : (
            <>
              <span className="text-base font-bold mr-0.5">₹</span>
              {formatCount(summary?.total_revenue ?? 0)}
            </>
          )}
        </p>
      </div>

      {/* Avg Order Value */}
      <div className="bg-card border border-line rounded-lg p-4">
        <p className="text-xs font-bold text-ink-muted">Avg Order Value</p>
        <p className="text-[28px] font-bold font-mono leading-[1.1] mt-1 tabular-nums">
          {isLoading ? (
            <span className="text-ink-muted">--</span>
          ) : (
            <>
              <span className="text-base font-bold mr-0.5">₹</span>
              {formatCount(summary?.average_order_value ?? 0)}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
