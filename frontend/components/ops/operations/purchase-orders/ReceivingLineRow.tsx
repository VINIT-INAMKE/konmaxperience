'use client';

import { Input } from '@/components/ui/input';
import type { PurchaseOrderLine } from '@/lib/types/purchase-order';

interface ReceivingLineRowProps {
  line: PurchaseOrderLine;
  receivedQty: string;
  onReceivedQtyChange: (lineId: string, qty: string) => void;
}

export function ReceivingLineRow({
  line,
  receivedQty,
  onReceivedQtyChange,
}: ReceivingLineRowProps) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-2 text-sm font-medium">
        {line.ingredient?.name ?? '\u2014'}
      </td>
      <td className="px-4 py-2 font-mono text-sm text-muted-foreground">
        {line.quantity} {line.unit}
      </td>
      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
        INR {Number(line.unit_cost).toLocaleString('en-IN')}
      </td>
      <td className="px-4 py-2 font-mono text-sm text-muted-foreground">
        INR {(Number(line.quantity) * Number(line.unit_cost)).toLocaleString('en-IN')}
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          min="0"
          step="any"
          value={receivedQty}
          onChange={(e) => onReceivedQtyChange(line.id, e.target.value)}
          className="h-8 w-24 text-xs font-mono"
        />
      </td>
    </tr>
  );
}
