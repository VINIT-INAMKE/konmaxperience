'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { useRazorpay } from '@/hooks/use-razorpay';
import type { RecordPaymentPayload, Payment, PaymentMethod } from '@/lib/types/orders';
import { Loader2 } from 'lucide-react';

interface PaymentFormProps {
  orderId: string;
  orderTotal: number;
  onPaymentRecorded: () => void;
}

export function PaymentForm({ orderId, orderTotal, onPaymentRecorded }: PaymentFormProps) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState<string>(String(orderTotal));
  const [notes, setNotes] = useState('');
  const [rzpLoading, setRzpLoading] = useState(false);

  const handleRazorpaySuccess = useCallback(
    async (response: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }) => {
      await apiClient.post(`/orders/${orderId}/razorpay-confirm`, {
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature,
      });
      toast.success('Payment confirmed via Razorpay');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      onPaymentRecorded();
    },
    [orderId, queryClient, onPaymentRecorded],
  );

  const { state: rzpState, openCheckout, reset: resetRzp } = useRazorpay({
    onSuccess: handleRazorpaySuccess,
    onDismiss: () => {
      toast.info('Payment cancelled');
      setRzpLoading(false);
    },
    onFailed: () => {
      toast.error('Payment failed — ask customer to try again');
      setRzpLoading(false);
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: RecordPaymentPayload) =>
      apiClient.post<Payment>('/orders/' + orderId + '/payment', payload),
    onSuccess: () => {
      toast.success('Payment recorded');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      onPaymentRecorded();
    },
    onError: () => {
      toast.error('Payment not recorded. Try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      method,
      amount: parseFloat(amount) || 0,
      notes: notes || undefined,
    });
  };

  const handleOpenRazorpay = useCallback(async () => {
    setRzpLoading(true);
    resetRzp();
    try {
      const result = await apiClient.post<{ razorpay_order_id: string }>(
        `/orders/${orderId}/razorpay-order`,
        {},
      );
      await openCheckout({
        razorpayOrderId: result.razorpay_order_id,
        description: `Order #${orderId.slice(0, 8)}`,
      });
    } catch {
      toast.error('Could not create Razorpay order — try again');
      setRzpLoading(false);
    }
  }, [orderId, openCheckout, resetRzp]);

  const isRazorpay = method === 'razorpay';
  const isRzpBusy =
    rzpLoading ||
    rzpState === 'loading-script' ||
    rzpState === 'creating-order' ||
    rzpState === 'razorpay-open' ||
    rzpState === 'confirming';

  let rzpButtonLabel = 'Open Razorpay';
  if (rzpState === 'loading-script' || rzpState === 'creating-order') {
    rzpButtonLabel = 'Opening...';
  } else if (rzpState === 'razorpay-open') {
    rzpButtonLabel = 'Awaiting payment...';
  } else if (rzpState === 'confirming') {
    rzpButtonLabel = 'Confirming...';
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-2">
      <div className="space-y-1">
        <label className="text-xs font-bold text-muted-foreground">Method</label>
        <Select
          value={method}
          onValueChange={(v: string | null) => setMethod((v ?? 'cash') as PaymentMethod)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="razorpay">Razorpay</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isRazorpay ? (
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground">
            Exact amount (set by order)
          </label>
          <p className="text-sm font-mono font-bold text-foreground">
            {'\u20B9'}{orderTotal}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground">Amount</label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      )}

      {!isRazorpay && (
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground">Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Split — cash &#8377;300 + UPI &#8377;200"
          />
        </div>
      )}

      {isRazorpay ? (
        <Button
          type="button"
          className="w-full"
          disabled={isRzpBusy}
          onClick={() => void handleOpenRazorpay()}
        >
          {isRzpBusy ? (
            <>
              <Loader2 className="size-4 animate-spin mr-1.5" />
              {rzpButtonLabel}
            </>
          ) : (
            rzpButtonLabel
          )}
        </Button>
      ) : (
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin mr-1.5" />
              Recording...
            </>
          ) : (
            'Record Payment'
          )}
        </Button>
      )}
    </form>
  );
}
