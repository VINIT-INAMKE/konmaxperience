'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, PackagePlus } from 'lucide-react';
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
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format/currency';
import { SHIPMENTS_KEY } from '@/lib/hooks/use-shipments-realtime';
import type { PackShipmentPayload, Shipment } from '@/lib/types/shipments';
import type { OrderItem } from '@/lib/types/orders';
import { useShippingSettings, type OrderListRow } from './shipments-queries';

/**
 * Weight and pickup point are **overrides**, not required input.
 *
 * Left blank, `POST /shipments/pack` sums `Product.weight_grams × quantity`
 * over the shipped lines and falls back to
 * `SystemSetting['shipping'].default_weight_grams`. The staff orders API does
 * not expose `Product.weight_grams`, so prefilling this box with the flat
 * default would *replace* an accurate per-product sum with a guess — worse than
 * leaving it empty. The packer fills it in when the parcel has been on a scale,
 * which is the only time a number here beats the catalogue.
 */
const packSchema = z.object({
  weight_grams: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' ||
        (/^\d+$/.test(value) &&
          Number(value) >= 1 &&
          Number(value) <= 1_000_000),
      'Enter a whole number of grams from 1 to 1,000,000, or leave it blank.',
    ),
  pickup_location_code: z
    .string()
    .trim()
    .max(64, 'Pickup location codes are at most 64 characters.'),
});

type PackFormValues = z.infer<typeof packSchema>;

interface PackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderListRow;
  shippedItems: OrderItem[];
}

export function PackDialog({
  open,
  onOpenChange,
  order,
  shippedItems,
}: PackDialogProps) {
  const queryClient = useQueryClient();
  const { shipping, fromServer } = useShippingSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PackFormValues>({
    resolver: zodResolver(packSchema),
    defaultValues: { weight_grams: '', pickup_location_code: '' },
  });

  // The settings read resolves after first paint, so the pickup code is seeded
  // from an effect rather than from `defaultValues`.
  useEffect(() => {
    if (!open) return;
    reset({
      weight_grams: '',
      pickup_location_code: shipping.pickup_location_code ?? '',
    });
  }, [open, reset, shipping.pickup_location_code]);

  const packMutation = useMutation({
    mutationFn: (payload: PackShipmentPayload) =>
      apiClient.post<Shipment>('/shipments/pack', payload),
    onSuccess: (shipment) => {
      void queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY });
      // `Shipment.order_id` is unique and the service handles the P2002, so a
      // second press returns the first row. That is a success, not an error —
      // two people at the same bench must never see a red toast for it.
      toast.success(`Order #${order.order_number} is packed`, {
        description: shipment.awb
          ? `AWB ${shipment.awb} is already on this parcel.`
          : 'Assign an AWB next to hand it to the courier.',
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        apiErrorMessage(
          error,
          'Could not pack this order. Refresh and try again.',
        ),
      );
    },
  });

  const units = shippedItems.reduce((sum, item) => sum + item.quantity, 0);

  function onSubmit(values: PackFormValues) {
    const payload: PackShipmentPayload = { order_id: order.id };
    if (values.weight_grams !== '') {
      payload.weight_grams = Number(values.weight_grams);
    }
    if (values.pickup_location_code !== '') {
      payload.pickup_location_code = values.pickup_location_code;
    }
    packMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pack order #{order.order_number}</DialogTitle>
          <DialogDescription>
            {units} {units === 1 ? 'unit' : 'units'} across{' '}
            {shippedItems.length}{' '}
            {shippedItems.length === 1 ? 'line' : 'lines'} go in this parcel.
            Local and booking lines on this order are handled elsewhere.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-surface-raised p-3 text-sm">
          {shippedItems.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                {item.product?.name ?? 'Product'}
              </span>
              <span className="shrink-0 font-mono text-xs text-ink-muted">
                ×{item.quantity} · {formatCurrency(item.unit_price)}
              </span>
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pack-weight">Parcel weight (grams)</Label>
            <Input
              id="pack-weight"
              inputMode="numeric"
              placeholder="Leave blank to weigh it from the catalogue"
              disabled={packMutation.isPending}
              aria-invalid={!!errors.weight_grams}
              aria-describedby="pack-weight-hint"
              {...register('weight_grams')}
            />
            <p id="pack-weight-hint" className="text-xs text-ink-muted">
              Blank means the server adds up each product&apos;s catalogue
              weight, falling back to{' '}
              {shipping.default_weight_grams.toLocaleString('en-IN')} g. Enter a
              number only when the parcel has been on a scale.
            </p>
            {errors.weight_grams && (
              <p className="text-xs text-destructive">
                {errors.weight_grams.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pack-pickup">Pickup location code</Label>
            <Input
              id="pack-pickup"
              placeholder="Leave blank for the configured default"
              disabled={packMutation.isPending}
              aria-invalid={!!errors.pickup_location_code}
              {...register('pickup_location_code')}
            />
            {!fromServer && (
              <p className="text-xs text-ink-muted">
                The shipping settings need the system permission to read, so
                this box starts empty — blank still uses the configured default.
              </p>
            )}
            {errors.pickup_location_code && (
              <p className="text-xs text-destructive">
                {errors.pickup_location_code.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={packMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={packMutation.isPending}>
              {packMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Packing…
                </>
              ) : (
                <>
                  <PackagePlus className="size-4" />
                  Pack parcel
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
