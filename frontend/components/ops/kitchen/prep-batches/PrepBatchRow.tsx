'use client';

import type { PrepBatch } from '@/lib/types/kitchen';
import { PrepBatchStatusBadge } from './PrepBatchStatusBadge';
import { ExpiresInCountdown } from './ExpiresInCountdown';

interface PrepBatchRowProps {
  batch: PrepBatch;
}

export function PrepBatchRow({ batch }: PrepBatchRowProps) {
  const isExpired = batch.status === 'expired';

  return (
    <tr className={`border-b transition-colors hover:bg-muted/50 ${isExpired ? 'text-destructive/60' : ''}`}>
      <td className="px-4 py-3 text-sm">
        {batch.recipe?.name ?? 'Unknown'}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums">
        {batch.quantity_remaining}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums">
        {batch.quantity_produced}
      </td>
      <td className="px-4 py-3 text-sm">
        {batch.unit}
      </td>
      <td className="px-4 py-3">
        <ExpiresInCountdown expiresAt={batch.expires_at} />
      </td>
      <td className="px-4 py-3">
        <PrepBatchStatusBadge status={batch.status} />
      </td>
    </tr>
  );
}
