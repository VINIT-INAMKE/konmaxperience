'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format/currency';
import { refundableAmount } from '@/lib/types/refunds';
import type { CreateRefundPayload, Refund } from '@/lib/types/refunds';
import type { StaffPayment } from './types';

/** `CreateRefundDto` bounds the reason at 3–200 characters; mirror it exactly. */
const REASON_MIN = 3;
const REASON_MAX = 200;

interface RefundDialogProps {
  orderId: string;
  orderNumber: number;
  payment: StaffPayment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * `POST /orders/:id/refund { amount?, reason }`.
 *
 * Three server behaviours the dialog renders honestly rather than smoothing over:
 *
 * - **Omitting `amount` means "everything left".** The service recomputes the
 *   balance rather than trusting a figure this screen may have read from a stale
 *   order, so the full-refund path sends no amount at all.
 * - **A full refund is not just money.** It sets `Order.status = refunded` and
 *   claws loyalty back — the points earned on the order are reversed and the
 *   points redeemed against it are restored. The confirm copy says so.
 * - **A gateway failure is a `400`, and the `Refund` row stays `failed`.** The
 *   row is real and shows up in the history, so the dialog surfaces the server's
 *   message (which prefers Razorpay's own `description`) verbatim and the caller
 *   refetches the ledger either way.
 *
 * This is the money path, so nothing here is optimistic (P5b decision 24).
 */
export function RefundDialog({
  orderId,
  orderNumber,
  payment,
  open,
  onOpenChange,
}: RefundDialogProps) {
  const queryClient = useQueryClient();
  const balance = refundableAmount(payment);

  // The caller mounts this component only while the dialog is open, so these
  // initialisers *are* the reset: a reopened dialog never carries the previous
  // attempt's amount, reason or gateway error. A refund is not a form you resume.
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [amount, setAmount] = useState(() => balance.toFixed(2));
  const [reason, setReason] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: CreateRefundPayload) =>
      apiClient.post<Refund>(`/orders/${orderId}/refund`, payload),
    onSuccess: (refund) => {
      toast.success(
        `Refunded ${formatCurrency(refund.amount)} on order #${orderNumber}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      onOpenChange(false);
    },
    onError: (error) => {
      setServerError(
        apiErrorMessage(
          error,
          'The refund could not be completed. Check the ledger below before retrying.',
        ),
      );
      // The failed `Refund` row is not rolled back, so the history has changed
      // even though the money did not move.
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const parsedAmount = Number.parseFloat(amount);
  const amountValid =
    mode === 'full' ||
    (Number.isFinite(parsedAmount) &&
      parsedAmount > 0 &&
      parsedAmount <= balance);
  const reasonValid =
    reason.trim().length >= REASON_MIN && reason.trim().length <= REASON_MAX;
  const isFullRefund =
    mode === 'full' || (amountValid && Math.abs(parsedAmount - balance) < 0.005);

  const submit = () => {
    setServerError(null);
    mutation.mutate({
      reason: reason.trim(),
      // Omitted on purpose for a full refund — see the module note.
      ...(mode === 'partial' ? { amount: Number(parsedAmount.toFixed(2)) } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Refund order #{orderNumber}</DialogTitle>
          <DialogDescription>
            {formatCurrency(balance)} of {formatCurrency(payment.amount)} is
            still refundable on this payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-ink-faint">Amount</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === 'full' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setMode('full')}
              >
                Full — {formatCurrency(balance)}
              </Button>
              <Button
                type="button"
                variant={mode === 'partial' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setMode('partial')}
              >
                Partial
              </Button>
            </div>
          </div>

          {mode === 'partial' ? (
            <div className="space-y-1.5">
              <label
                htmlFor="refund-amount"
                className="text-xs font-medium text-ink-faint"
              >
                Amount to refund (₹)
              </label>
              <Input
                id="refund-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={balance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {!amountValid ? (
                <p className="text-xs text-[var(--status-serious)]">
                  Enter an amount between {formatCurrency(0.01)} and{' '}
                  {formatCurrency(balance)}.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label
              htmlFor="refund-reason"
              className="text-xs font-medium text-ink-faint"
            >
              Reason (required)
            </label>
            <Textarea
              id="refund-reason"
              value={reason}
              maxLength={REASON_MAX}
              placeholder="e.g. Customer received the wrong variant"
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Recorded on the refund row, sent to Razorpay as a note and copied
              into the audit event. {reason.trim().length}/{REASON_MAX}
            </p>
          </div>

          {isFullRefund ? (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertTitle>A full refund closes the order</AlertTitle>
              <AlertDescription>
                The order moves to <strong>Refunded</strong> and loyalty is
                clawed back: the points it earned are reversed and the points the
                customer redeemed against it are restored.
              </AlertDescription>
            </Alert>
          ) : null}

          {serverError ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>The gateway refused this refund</AlertTitle>
              <AlertDescription>
                {serverError} The attempt is recorded as a failed refund in the
                ledger below.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={mutation.isPending || !amountValid || !reasonValid}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin motion-reduce:animate-none" />
                Refunding…
              </>
            ) : (
              'Refund'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
