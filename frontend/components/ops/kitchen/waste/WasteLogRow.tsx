'use client';

import type { WasteLog } from '@/lib/types/kitchen';
import { WASTE_TYPE_LABELS } from '@/lib/types/kitchen';
import { WasteReasonBadge } from './WasteReasonBadge';

interface WasteLogRowProps {
  entry: WasteLog;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function WasteLogRow({ entry }: WasteLogRowProps) {
  const itemName =
    entry.waste_type === 'ingredient'
      ? entry.ingredient?.name ?? 'Unknown'
      : entry.prep_batch?.recipe?.name ?? 'Unknown';

  const loggedBy = entry.creator?.name ?? 'System';

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formatDate(entry.created_at)}
      </td>
      <td className="px-4 py-3 text-sm">
        {WASTE_TYPE_LABELS[entry.waste_type]}
      </td>
      <td className="px-4 py-3 text-sm font-medium">{itemName}</td>
      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
        {entry.quantity} {entry.unit}
      </td>
      <td className="px-4 py-3">
        <WasteReasonBadge reason={entry.reason} />
      </td>
      <td className="px-4 py-3 text-sm font-mono text-right">
        {formatCurrency(Number(entry.cost_impact))}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{loggedBy}</td>
    </tr>
  );
}
