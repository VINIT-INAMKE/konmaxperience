'use client';

import type { VendorPrice } from '@/lib/types/vendor';

interface VendorPriceHistoryProps {
  prices: VendorPrice[];
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function VendorPriceHistory({ prices }: VendorPriceHistoryProps) {
  if (prices.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-muted-foreground">No prices recorded</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add the first price entry for this ingredient from this vendor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {prices.map((price, index) => {
        const isCurrent = index === 0;
        return (
          <div
            key={price.id}
            className={`flex items-center justify-between px-3 py-2 rounded text-sm ${
              isCurrent
                ? 'border-l-2 border-primary bg-primary/5'
                : 'text-muted-foreground'
            }`}
          >
            <span className={isCurrent ? 'font-medium' : ''}>
              {formatDate(price.effective_date)}
            </span>
            <div className="flex items-center gap-2">
              <span className={`font-mono ${isCurrent ? 'font-semibold' : ''}`}>
                ₹{Number(price.price).toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">/{price.unit}</span>
              {isCurrent && (
                <span className="text-xs text-primary font-medium">current</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
