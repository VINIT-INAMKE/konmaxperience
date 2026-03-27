'use client';

import type { SupplyUsageEntry } from '@/lib/types/kitchen';

interface SupplyUsageRowProps {
  entry: SupplyUsageEntry;
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

export function SupplyUsageRow({ entry }: SupplyUsageRowProps) {
  return (
    <tr className="border-b last:border-b-0 hover:bg-[var(--muted)]/30 transition-colors">
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formatDate(entry.created_at)}
      </td>
      <td className="px-4 py-3 text-sm font-medium">
        {entry.ingredient?.name ?? 'Unknown'}
      </td>
      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
        {entry.original_quantity}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {entry.unit}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
        {entry.reason ?? '--'}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {entry.creator?.name ?? 'System'}
      </td>
    </tr>
  );
}
