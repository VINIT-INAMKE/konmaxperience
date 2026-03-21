'use client';

import { useState } from 'react';
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
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-bold text-muted-foreground">Amount</label>
        <Input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-bold text-muted-foreground">Notes</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Split — cash &#8377;300 + UPI &#8377;200"
        />
      </div>
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
    </form>
  );
}
