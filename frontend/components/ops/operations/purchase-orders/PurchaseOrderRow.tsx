'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QuestTaskChip } from '@/components/ops/tasks/QuestTaskChip';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/lib/types/purchase-order';
import { PO_STATUS_BADGE_CLASSES, PO_STATUS_LABELS } from '@/lib/types/purchase-order';

interface PurchaseOrderRowProps {
  po: PurchaseOrder;
  onCancel: (po: PurchaseOrder) => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function PurchaseOrderRow({ po, onCancel }: PurchaseOrderRowProps) {
  const canCancel = po.status === 'draft' || po.status === 'ordered';

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2 text-sm font-medium">
        <div className="flex flex-col gap-1">
          <span>{po.vendor?.name ?? '\u2014'}</span>
          {/* SPEC \u00a76.4 \u2014 why this PO exists: the task that raised it. */}
          {po.linked_task && (
            <QuestTaskChip
              quest={po.linked_task.quest}
              task={{ id: po.linked_task.id, title: po.linked_task.title }}
              className="max-w-[220px]"
            />
          )}
        </div>
      </td>
      <td className="px-4 py-2 text-xs text-muted-foreground">
        {po.lines?.length ?? 0} items
      </td>
      <td className="px-4 py-2 font-mono text-sm">
        ₹{Number(po.total_amount).toLocaleString('en-IN')}
      </td>
      <td className="px-4 py-2">
        <Badge
          className={`text-xs border-0 ${PO_STATUS_BADGE_CLASSES[po.status as PurchaseOrderStatus]}`}
        >
          {PO_STATUS_LABELS[po.status as PurchaseOrderStatus]}
        </Badge>
      </td>
      <td className="px-4 py-2 text-xs text-muted-foreground">
        {formatDate(po.ordered_at)}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <Link href={`/operations/purchase-orders/${po.id}`}>
            <Button variant="outline" size="sm" className="h-7 text-xs px-3">
              View
            </Button>
          </Link>
          {canCancel && (
            <button
              onClick={() => onCancel(po)}
              className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              aria-label="Cancel purchase order"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
