'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Ticket } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient, apiErrorMessage, apiErrorStatus } from '@/lib/api-client';
import { SHIPMENTS_KEY } from '@/lib/hooks/use-shipments-realtime';
import type { AssignAwbPayload, ShipmentListRow } from '@/lib/types/shipments';

/**
 * Which fields the server will actually keep, read off
 * `ShipmentsService.assignAwb` rather than assumed:
 *
 * ```
 * awb          = issued.awb          ?? dto.awb ?? shipment.awb
 * courier_name = issued.courier_name ?? dto.courier_name ?? shipment.courier_name
 * tracking_url =                         dto.tracking_url ?? shipment.tracking_url
 * ```
 *
 * So with **`shiprocket`** the courier issues the AWB and the courier name and
 * a pasted value only ever fills a gap — showing staff editable boxes for them
 * would be a form whose input is silently discarded. The **tracking URL has no
 * provider term at all**: the body wins on both providers, because the adapter
 * only learns the URL at `track()` time and staff often have it first. It
 * therefore stays editable on the Shiprocket path too — a refinement on the
 * plan's "confirm-only" dialog, and the only shape that matches the code.
 *
 * The provider is read from `Shipment.provider` on the row, not from
 * `SystemSetting['shipping']`: the row records which provider *this* parcel was
 * registered with at pack time, and reading it needs no extra permission.
 */
const awbSchema = z.object({
  awb: z.string().trim().max(64, 'AWBs are at most 64 characters.'),
  courier_name: z
    .string()
    .trim()
    .max(120, 'Courier names are at most 120 characters.'),
  tracking_url: z
    .string()
    .trim()
    .max(512, 'Tracking links are at most 512 characters.')
    .refine(
      (value) => value === '' || /^https?:\/\/\S+$/i.test(value),
      'Enter a full link starting with http:// or https://.',
    ),
});

type AwbFormValues = z.infer<typeof awbSchema>;

interface AssignAwbDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: ShipmentListRow;
}

export function AssignAwbDialog({
  open,
  onOpenChange,
  shipment,
}: AssignAwbDialogProps) {
  const queryClient = useQueryClient();
  const isManual = shipment.provider === 'manual';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AwbFormValues>({
    resolver: zodResolver(awbSchema),
    defaultValues: { awb: '', courier_name: '', tracking_url: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      awb: shipment.awb ?? '',
      courier_name: shipment.courier_name ?? '',
      tracking_url: shipment.tracking_url ?? '',
    });
  }, [open, reset, shipment.awb, shipment.courier_name, shipment.tracking_url]);

  const awbMutation = useMutation({
    mutationFn: (payload: AssignAwbPayload) =>
      apiClient.post(`/shipments/${shipment.id}/awb`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY });
      toast.success('AWB assigned', {
        description: 'Schedule the pickup when the parcel is ready to leave.',
      });
      onOpenChange(false);
    },
    onError: (error) => {
      // `503` is the courier being unreachable, not a mistake staff made.
      const fallback =
        apiErrorStatus(error) === 503
          ? 'The courier did not answer. The parcel is unchanged — try again in a moment.'
          : 'Could not assign an AWB.';
      toast.error(apiErrorMessage(error, fallback));
    },
  });

  function onSubmit(values: AwbFormValues) {
    const payload: AssignAwbPayload = {};
    if (isManual) {
      if (values.awb !== '') payload.awb = values.awb;
      if (values.courier_name !== '') payload.courier_name = values.courier_name;
    }
    if (values.tracking_url !== '') payload.tracking_url = values.tracking_url;
    awbMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign an AWB</DialogTitle>
          <DialogDescription>
            Order #{shipment.order.order_number} ·{' '}
            {isManual ? 'Manual courier' : 'Shiprocket'}
          </DialogDescription>
        </DialogHeader>

        {!isManual && (
          <Alert>
            <Ticket className="size-4" />
            <AlertTitle>Shiprocket issues this AWB</AlertTitle>
            <AlertDescription>
              The waybill number and courier name come back from Shiprocket, so
              there is nothing to type. Confirm to request one.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {isManual && (
            <>
              <div className="space-y-2">
                <Label htmlFor="awb-number">AWB number</Label>
                <Input
                  id="awb-number"
                  placeholder="The number the courier wrote on the parcel"
                  disabled={awbMutation.isPending}
                  aria-invalid={!!errors.awb}
                  {...register('awb')}
                />
                {errors.awb && (
                  <p className="text-xs text-destructive">
                    {errors.awb.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="awb-courier">Courier name</Label>
                <Input
                  id="awb-courier"
                  placeholder="Delhivery, Blue Dart, the local runner…"
                  disabled={awbMutation.isPending}
                  aria-invalid={!!errors.courier_name}
                  {...register('courier_name')}
                />
                {errors.courier_name && (
                  <p className="text-xs text-destructive">
                    {errors.courier_name.message}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="awb-tracking">Tracking link (optional)</Label>
            <Input
              id="awb-tracking"
              type="url"
              placeholder="https://…"
              disabled={awbMutation.isPending}
              aria-invalid={!!errors.tracking_url}
              aria-describedby="awb-tracking-hint"
              {...register('tracking_url')}
            />
            <p id="awb-tracking-hint" className="text-xs text-ink-muted">
              This is the page the customer opens to follow the parcel. It is
              kept on both providers.
            </p>
            {errors.tracking_url && (
              <p className="text-xs text-destructive">
                {errors.tracking_url.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={awbMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={awbMutation.isPending}>
              {awbMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Assigning…
                </>
              ) : (
                <>
                  <Ticket className="size-4" />
                  {isManual ? 'Assign AWB' : 'Request AWB'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
