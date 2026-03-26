/**
 * Pure HTML template functions for order and booking receipts.
 * These return complete HTML documents suitable for direct browser rendering
 * with print-optimized CSS.
 */

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCurrency(amount: number | string): string {
  return Number(amount).toFixed(2);
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function channelLabel(channel: string): string {
  switch (channel) {
    case 'takeaway':
      return 'Takeaway';
    case 'delivery':
      return 'Delivery';
    case 'dine_in':
      return 'Dine In';
    default:
      return channel;
  }
}

const baseStyles = `
  body {
    font-family: sans-serif;
    max-width: 400px;
    margin: 0 auto;
    padding: 20px;
    color: #333;
    font-size: 14px;
    line-height: 1.5;
  }
  @media print {
    body { margin: 0; padding: 10px; }
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 16px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .header { text-align: center; margin-bottom: 16px; }
  .header .subtitle { color: #666; font-size: 12px; }
  .meta { margin-bottom: 12px; }
  .meta p { margin: 2px 0; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; page-break-inside: avoid; }
  th, td { text-align: left; padding: 4px 6px; font-size: 13px; }
  th { border-bottom: 1px solid #999; font-weight: 600; }
  td { border-bottom: 1px solid #eee; }
  td.right, th.right { text-align: right; }
  .totals { margin-top: 8px; page-break-inside: avoid; }
  .totals p { margin: 2px 0; font-size: 13px; display: flex; justify-content: space-between; }
  .totals .grand-total { font-weight: bold; font-size: 15px; border-top: 1px solid #333; padding-top: 4px; margin-top: 4px; }
  .payment-info { margin-top: 12px; font-size: 13px; page-break-inside: avoid; }
  .payment-info p { margin: 2px 0; }
  .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; page-break-inside: avoid; }
`;

export function renderOrderReceipt(order: {
  order_number: number;
  channel: string;
  created_at: Date | string;
  subtotal: number | string;
  channel_modifier_amount: number | string;
  total: number | string;
  delivery_address?: string | null;
  items: Array<{
    menu_item?: { name: string } | null;
    quantity: number;
    unit_price: number | string;
  }>;
  payment?: {
    method: string;
    razorpay_payment_id?: string | null;
  } | null;
  customer?: {
    name?: string | null;
    phone: string;
  } | null;
}): string {
  const modifierAmount = Number(order.channel_modifier_amount);

  const itemRows = order.items
    .map((item) => {
      const name = escapeHtml(item.menu_item?.name ?? 'Unknown Item');
      const lineTotal = Number(item.unit_price) * item.quantity;
      return `<tr>
        <td>${name}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${formatCurrency(item.unit_price)}</td>
        <td class="right">${formatCurrency(lineTotal)}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Order Receipt - #${order.order_number}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Konma Xperience</h1>
    <div class="subtitle">Tax Invoice</div>
  </div>

  <div class="meta">
    <p><strong>Order #${order.order_number}</strong></p>
    <p>${formatDate(order.created_at)}</p>
    <p>Channel: ${channelLabel(order.channel)}</p>
    ${order.customer?.name ? `<p>Customer: ${escapeHtml(order.customer.name)}</p>` : ''}
    ${order.customer?.phone ? `<p>Phone: ${escapeHtml(order.customer.phone)}</p>` : ''}
    ${order.delivery_address ? `<p>Delivery: ${escapeHtml(order.delivery_address)}</p>` : ''}
  </div>

  <h2>Items</h2>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="right">Qty</th>
        <th class="right">Price</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <p><span>Subtotal</span><span>${formatCurrency(order.subtotal)}</span></p>
    ${modifierAmount > 0 ? `<p><span>Delivery Charge</span><span>${formatCurrency(modifierAmount)}</span></p>` : ''}
    <p class="grand-total"><span>Total</span><span>INR ${formatCurrency(order.total)}</span></p>
  </div>

  ${
    order.payment
      ? `<div class="payment-info">
    <h2>Payment</h2>
    <p>Method: ${escapeHtml(order.payment.method)}</p>
    ${order.payment.razorpay_payment_id ? `<p>Razorpay ID: ${escapeHtml(order.payment.razorpay_payment_id)}</p>` : ''}
  </div>`
      : ''
  }

  <div class="footer">
    <p>Thank you for your order!</p>
  </div>
</body>
</html>`;
}

export function renderBookingReceipt(booking: {
  id: string;
  customer_name: string;
  customer_phone: string;
  guests: number;
  payment_status: string;
  payment_amount?: number | string | null;
  razorpay_payment_id?: string | null;
  created_at: Date | string;
  event: {
    title: string;
    date: Date | string;
  };
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Booking Receipt - ${escapeHtml(booking.event.title)}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Konma Xperience</h1>
    <div class="subtitle">Booking Confirmation</div>
  </div>

  <div class="meta">
    <p><strong>${escapeHtml(booking.event.title)}</strong></p>
    <p>Event Date: ${formatDate(booking.event.date)}</p>
    <p>Booked On: ${formatDate(booking.created_at)}</p>
  </div>

  <h2>Guest Details</h2>
  <div class="meta">
    <p>Name: ${escapeHtml(booking.customer_name)}</p>
    <p>Phone: ${escapeHtml(booking.customer_phone)}</p>
    <p>Guests: ${booking.guests}</p>
  </div>

  <div class="totals">
    ${booking.payment_amount ? `<p class="grand-total"><span>Amount Paid</span><span>INR ${formatCurrency(booking.payment_amount)}</span></p>` : '<p>Free Event</p>'}
  </div>

  <div class="payment-info">
    <h2>Payment</h2>
    <p>Status: ${escapeHtml(booking.payment_status)}</p>
    ${booking.razorpay_payment_id ? `<p>Razorpay ID: ${escapeHtml(booking.razorpay_payment_id)}</p>` : ''}
  </div>

  <div class="footer">
    <p>Thank you for your booking!</p>
  </div>
</body>
</html>`;
}
