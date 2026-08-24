'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient, apiErrorMessage, apiErrorStatus } from '@/lib/api-client';
import type { ShipmentLabel, ShipmentListRow } from '@/lib/types/shipments';

interface LabelButtonProps {
  shipment: ShipmentListRow;
  size?: 'sm' | 'default';
}

/**
 * `GET /shipments/:id/label` has three answers and they mean different things:
 *
 * - **`200 { label_url: "https://…" }`** — open it in a new tab.
 * - **`200 { label_url: null }`** — a `manual` shipment. There is no label to
 *   print; the courier's own paperwork travels with the parcel. This is a
 *   *normal* answer, so it gets an informational toast, never an error one.
 * - **`400`** — no AWB yet. The server's message says exactly that, so it is
 *   shown verbatim.
 *
 * Printing is not a status transition — a label can be reprinted at any point
 * after the AWB exists — so this button is never gated by the lifecycle, only
 * by whether an AWB is on the row.
 */
export function LabelButton({ shipment, size = 'sm' }: LabelButtonProps) {
  const hasAwb = Boolean(shipment.awb);

  const labelMutation = useMutation({
    mutationFn: () =>
      apiClient.get<ShipmentLabel>(`/shipments/${shipment.id}/label`),
    onSuccess: (result) => {
      if (result.label_url) {
        window.open(result.label_url, '_blank', 'noopener,noreferrer');
        return;
      }
      toast.info('No label for manual shipments', {
        description:
          'This parcel was booked with the manual provider, which issues no printable label.',
      });
    },
    onError: (error) => {
      const fallback =
        apiErrorStatus(error) === 400
          ? 'Assign an AWB before printing a label.'
          : 'Could not fetch the label.';
      toast.error(apiErrorMessage(error, fallback));
    },
  });

  return (
    <Button
      size={size}
      variant="outline"
      disabled={!hasAwb || labelMutation.isPending}
      title={hasAwb ? undefined : 'Assign an AWB before printing a label'}
      onClick={() => labelMutation.mutate()}
    >
      {labelMutation.isPending ? (
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
      ) : (
        <FileText className="size-3.5" />
      )}
      Label
    </Button>
  );
}
