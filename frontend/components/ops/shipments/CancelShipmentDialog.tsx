'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import { SHIPMENTS_KEY } from '@/lib/hooks/use-shipments-realtime';
import type { CancelShipmentPayload, ShipmentListRow } from '@/lib/types/shipments';

/**
 * The server takes `reason` as optional; this dialog requires it.
 *
 * A cancellation is written into the `ShipmentEvent` ledger forever and is the
 * one action here that cannot be walked back — `cancelled` is terminal and has
 * no outgoing transition. An unexplained row in that ledger is a question
 * nobody can answer a month later, so the stricter client rule is deliberate.
 */
const cancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(4, 'Say why in a few words — this goes in the parcel’s permanent record.')
    .max(280, 'Keep the reason under 280 characters.'),
});

type CancelFormValues = z.infer<typeof cancelSchema>;

interface CancelShipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: ShipmentListRow;
}

export function CancelShipmentDialog({
  open,
  onOpenChange,
  shipment,
}: CancelShipmentDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelFormValues>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { reason: '' },
  });

  useEffect(() => {
    if (open) reset({ reason: '' });
  }, [open, reset]);

  const cancelMutation = useMutation({
    mutationFn: (payload: CancelShipmentPayload) =>
      apiClient.post(`/shipments/${shipment.id}/cancel`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY });
      toast.success(`Parcel for order #${shipment.order.order_number} cancelled`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        apiErrorMessage(
          error,
          'Could not cancel this parcel. The courier may already have it.',
        ),
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this parcel</DialogTitle>
          <DialogDescription>
            Order #{shipment.order.order_number}. The courier is told to stand
            down and the parcel cannot be un-cancelled. The order itself is not
            cancelled by this.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((v) => cancelMutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              placeholder="Customer changed their mind before pickup…"
              disabled={cancelMutation.isPending}
              aria-invalid={!!errors.reason}
              {...register('reason')}
            />
            {errors.reason && (
              <p className="text-xs text-destructive">{errors.reason.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={cancelMutation.isPending}
            >
              Keep the parcel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Cancelling…
                </>
              ) : (
                <>
                  <XCircle className="size-4" />
                  Cancel parcel
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
