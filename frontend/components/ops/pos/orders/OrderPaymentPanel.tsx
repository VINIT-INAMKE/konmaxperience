'use client';

import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { OrderStatusBadge } from '@/components/ops/pos/OrderStatusBadge';
import { PaymentForm } from '@/components/ops/pos/PaymentForm';
import { formatCurrency } from '@/lib/format/currency';
import { formatDateTime } from '@/lib/format/date';
import { PAYMENT_METHOD_LABELS } from '@/lib/types/orders';
import { refundableAmount } from '@/lib/types/refunds';
import type { StaffOrderDetail } from './types';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm text-ink">
        {value}
      </span>
    </div>
  );
}

interface OrderPaymentPanelProps {
  order: StaffOrderDetail;
  onChanged: () => void;
}

/**
 * The payment row: method, status (including `partially_refunded`), the amount
 * taken, how much of it has already gone back, and the gateway handles.
 *
 * When there is no payment yet the panel becomes the till: `PaymentForm` records
 * cash/card/UPI or drives the POS Razorpay flow. That capability lived on the
 * old order-detail sheet and comes forward with the route rather than being lost
 * to it.
 */
export function OrderPaymentPanel({ order, onChanged }: OrderPaymentPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const payment = order.payment;

  return (
    <section className="space-y-3 rounded-xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <CreditCard className="size-4 text-ink-muted" />
        <h2 className="text-sm font-semibold text-ink">Payment</h2>
      </div>

      {payment ? (
        <div className="space-y-2">
          <Row
            label="Method"
            value={PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Status</span>
            <OrderStatusBadge paymentStatus={payment.status} />
          </div>
          <Row
            label="Amount taken"
            value={
              <span className="font-mono font-semibold tabular-nums">
                {formatCurrency(payment.amount)}
              </span>
            }
          />
          <Row
            label="Refunded"
            value={
              <span className="font-mono tabular-nums">
                {formatCurrency(payment.refunded_amount)}
              </span>
            }
          />

          <Separator className="my-1" />

          <Row
            label="Refundable balance"
            value={
              <span className="font-mono font-semibold tabular-nums">
                {formatCurrency(refundableAmount(payment))}
              </span>
            }
          />

          {payment.razorpay_payment_id ? (
            <Row
              label="Razorpay payment"
              value={
                <span className="font-mono text-xs">
                  {payment.razorpay_payment_id}
                </span>
              }
            />
          ) : null}
          {payment.razorpay_order_id ? (
            <Row
              label="Razorpay order"
              value={
                <span className="font-mono text-xs">
                  {payment.razorpay_order_id}
                </span>
              }
            />
          ) : null}
          {payment.notes ? <Row label="Notes" value={payment.notes} /> : null}
          <Row label="Taken at" value={formatDateTime(payment.created_at)} />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            No payment has been recorded against this order yet.
          </p>
          {showForm ? (
            <PaymentForm
              orderId={order.id}
              orderTotal={order.total}
              onPaymentRecorded={() => {
                setShowForm(false);
                onChanged();
              }}
            />
          ) : (
            <Button className="w-full" onClick={() => setShowForm(true)}>
              Record payment
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
