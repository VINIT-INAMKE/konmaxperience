'use client';

import { Receipt, ExternalLink } from 'lucide-react';
import type { CustomerOrder } from '@/lib/types/marketplace';
import type { OrderStatus } from '@/lib/types/kds';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface CustomerOrderCardProps {
  order: CustomerOrder;
  onReorder: (order: CustomerOrder) => void;
}

/** Exhaustive over Prisma `OrderStatus` so a new member cannot render unstyled. */
const STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  placed: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-blue-50 text-blue-700',
  preparing: 'bg-amber-50 text-amber-700',
  ready: 'bg-orange-50 text-orange-700',
  dispatched: 'bg-orange-50 text-orange-700',
  shipped: 'bg-orange-50 text-orange-700',
  delivered: 'bg-green-50 text-green-700',
  served: 'bg-green-50 text-green-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-stone-100 text-stone-500',
  refunded: 'bg-stone-100 text-stone-500',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function summarizeItems(
  items: CustomerOrder['items'],
): string {
  if (items.length === 0) return '';
  const names = items.map((i) => i.product.name);
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

export function CustomerOrderCard({
  order,
  onReorder,
}: CustomerOrderCardProps) {
  const badgeClass =
    STATUS_BADGE_CLASSES[order.status] ?? 'bg-stone-100 text-stone-500';

  const openReceipt = () => {
    window.open(
      `${API_BASE_URL}/customer/orders/${order.id}/receipt`,
      '_blank',
    );
  };

  return (
    <div className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 space-y-2">
      {/* Header row: order number + status badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono text-[var(--public-muted)]">
          #{order.order_number}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${badgeClass}`}
        >
          {order.status}
        </span>
      </div>

      {/* Date */}
      <p className="text-xs text-[var(--public-muted)]">
        {formatDate(order.created_at)}
      </p>

      {/* Items summary */}
      <p className="text-sm text-[var(--public-fg-subtle)]">
        {summarizeItems(order.items)}
      </p>

      {/* Total */}
      <p className="text-base font-semibold text-[var(--public-fg)]">
        {'\u20B9'}
        {order.total.toFixed(2)}
      </p>

      {/* Actions row */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={openReceipt}
          className="inline-flex items-center gap-1 text-xs border border-[var(--public-border)] text-[var(--public-fg-subtle)] rounded-lg px-3 py-1.5 hover:bg-[var(--public-surface)]"
        >
          <Receipt className="size-3" />
          Receipt
          <ExternalLink className="size-2.5" />
        </button>
        <button
          type="button"
          onClick={() => onReorder(order)}
          className="text-xs bg-[var(--public-terracotta)] text-white rounded-lg px-3 py-1.5 font-medium hover:bg-[var(--public-terracotta-hover)]"
        >
          Order again
        </button>
      </div>
    </div>
  );
}
