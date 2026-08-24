'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient, apiErrorMessage, apiErrorStatus } from '@/lib/api-client';
import { SHIPMENTS_KEY } from '@/lib/hooks/use-shipments-realtime';
import type { ShipmentListRow } from '@/lib/types/shipments';

interface SchedulePickupButtonProps {
  shipment: ShipmentListRow;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline';
}

/**
 * `POST /shipments/:id/pickup` — asks the courier to collect.
 *
 * **It does not ship the order.** `Order.status → shipped` is driven by the
 * courier's own scans (`picked_up` / `in_transit` / `out_for_delivery`) arriving
 * on the Shiprocket webhook, not by this button; a runtime probe against a live
 * server confirmed it. The copy says so, because "schedule pickup ships the
 * order" would have staff waiting for a status change that only a courier can
 * cause.
 *
 * The server also refuses a pickup without an AWB, so the button is disabled
 * with the reason spelled out rather than letting staff earn a 400.
 */
export function SchedulePickupButton({
  shipment,
  size = 'sm',
  variant = 'default',
}: SchedulePickupButtonProps) {
  const queryClient = useQueryClient();
  const hasAwb = Boolean(shipment.awb);

  const pickupMutation = useMutation({
    mutationFn: () => apiClient.post(`/shipments/${shipment.id}/pickup`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY });
      toast.success('Pickup scheduled', {
        description:
          'The order moves to Shipped on the courier’s first scan, not now.',
      });
    },
    onError: (error) => {
      const fallback =
        apiErrorStatus(error) === 503
          ? 'The courier did not answer. Nothing changed — try again in a moment.'
          : 'Could not schedule the pickup.';
      toast.error(apiErrorMessage(error, fallback));
    },
  });

  return (
    <Button
      size={size}
      variant={variant}
      disabled={!hasAwb || pickupMutation.isPending}
      title={hasAwb ? undefined : 'Assign an AWB before scheduling a pickup'}
      onClick={() => pickupMutation.mutate()}
    >
      {pickupMutation.isPending ? (
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
      ) : (
        <CalendarClock className="size-3.5" />
      )}
      Schedule pickup
    </Button>
  );
}
