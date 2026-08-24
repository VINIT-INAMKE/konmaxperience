'use client';

import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format/currency';
import { formatDateTime } from '@/lib/format/date';
import { ORDER_CHANNEL_LABELS } from '@/lib/types/kds';
import { PAYMENT_METHOD_LABELS } from '@/lib/types/orders';
import { discountSplit } from './OrderDetailHeader';
import type { StaffOrderDetail } from './types';

/**
 * **Deviation, stated plainly: there is no staff receipt endpoint.**
 *
 * The only receipt route in the backend is `GET /customer/orders/:id/receipt`,
 * which resolves the order against `req.user.customerId` behind `CustomerGuard`
 * — a `MANAGE_POS` staffer cannot call it, and adding a staff route would mean
 * editing `backend/`, which this task does not own.
 *
 * So the receipt is rendered here from the order already on screen and handed to
 * the browser's print dialog. It carries exactly the figures the detail header
 * shows, under the same inclusive-tax rule: `tax_amount` is printed as an *of
 * which* line and never added to the total.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReceiptHtml(
  order: StaffOrderDetail,
  redeemValuePerPoint: number,
): string {
  const { coupon, loyalty } = discountSplit(order, redeemValuePerPoint);

  const lines = order.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.product?.name ?? 'Item')}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${escapeHtml(formatCurrency(item.unit_price))}</td>
          <td class="num">${escapeHtml(
            formatCurrency(item.unit_price * item.quantity),
          )}</td>
        </tr>`,
    )
    .join('');

  const money = (label: string, value: number, negative = false) =>
    `<tr><td colspan="3">${escapeHtml(label)}</td><td class="num">${
      negative ? '−' : ''
    }${escapeHtml(formatCurrency(value))}</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Order #${order.order_number} receipt</title>
<style>
  body { font-family: ui-monospace, "Courier New", monospace; font-size: 12px; margin: 16px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { padding: 4px 2px; text-align: left; vertical-align: top; }
  thead th { border-bottom: 1px solid currentColor; }
  .num { text-align: right; white-space: nowrap; }
  tfoot td { padding-top: 6px; }
  tfoot tr.total td { border-top: 1px solid currentColor; font-weight: bold; }
  .note { margin-top: 10px; font-size: 11px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>Order #${order.order_number}</h1>
  <p>${escapeHtml(formatDateTime(order.created_at))}</p>
  <p>${escapeHtml(ORDER_CHANNEL_LABELS[order.channel] ?? order.channel)}</p>
  <p>${escapeHtml(order.customer_name ?? order.customer_phone ?? 'Walk-in')}</p>

  <table>
    <thead>
      <tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr>
    </thead>
    <tbody>${lines}</tbody>
    <tfoot>
      ${money('Subtotal (incl. GST)', order.subtotal)}
      ${order.channel_modifier_amount > 0 ? money('Channel modifier', order.channel_modifier_amount) : ''}
      ${coupon > 0 ? money('Coupon discount', coupon, true) : ''}
      ${
        loyalty > 0
          ? money(
              `Loyalty redeemed (${order.loyalty_points_redeemed} pts)`,
              loyalty,
              true,
            )
          : ''
      }
      ${order.shipping_amount > 0 ? money('Shipping', order.shipping_amount) : ''}
      <tr class="total"><td colspan="3">Total</td><td class="num">${escapeHtml(
        formatCurrency(order.total),
      )}</td></tr>
    </tfoot>
  </table>

  <p class="note">of which GST ${escapeHtml(formatCurrency(order.tax_amount))} — included in the subtotal above, not added to it.</p>
  ${
    order.payment
      ? `<p class="note">Paid by ${escapeHtml(
          PAYMENT_METHOD_LABELS[order.payment.method] ?? order.payment.method,
        )} — ${escapeHtml(formatCurrency(order.payment.amount))}${
          order.payment.refunded_amount > 0
            ? `, refunded ${escapeHtml(formatCurrency(order.payment.refunded_amount))}`
            : ''
        }.</p>`
      : '<p class="note">No payment recorded.</p>'
  }
  ${
    order.loyalty_points_earned > 0
      ? `<p class="note">Loyalty earned: ${order.loyalty_points_earned} points.</p>`
      : ''
  }
</body>
</html>`;
}

interface OrderReceiptButtonProps {
  order: StaffOrderDetail;
  redeemValuePerPoint: number;
}

export function OrderReceiptButton({
  order,
  redeemValuePerPoint,
}: OrderReceiptButtonProps) {
  const print = () => {
    const win = window.open('', '_blank', 'width=420,height=680');
    if (!win) {
      toast.error('Allow pop-ups for this site to print the receipt.');
      return;
    }
    win.document.write(buildReceiptHtml(order, redeemValuePerPoint));
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Button variant="outline" size="sm" onClick={print}>
      <Printer className="size-4" />
      Print receipt
    </Button>
  );
}
