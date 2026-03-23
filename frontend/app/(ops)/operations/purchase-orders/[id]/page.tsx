'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MagicCard } from '@/components/ui/magic-card';
import { ShineBorder } from '@/components/ui/shine-border';
import { BorderBeam } from '@/components/ui/border-beam';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReceivingLineRow } from '@/components/ops/operations/purchase-orders/ReceivingLineRow';
import { apiClient } from '@/lib/api-client';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/lib/types/purchase-order';
import { PO_STATUS_BADGE_CLASSES, PO_STATUS_LABELS } from '@/lib/types/purchase-order';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [receivedQuantities, setReceivedQuantities] = useState<
    Record<string, string>
  >({});
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const {
    data: po,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => apiClient.get<PurchaseOrder>(`/purchase-orders/${id}`),
    enabled: !!id,
  });

  // Initialize received quantities from ordered quantities
  useEffect(() => {
    if (po?.lines && Object.keys(receivedQuantities).length === 0) {
      const initial: Record<string, string> = {};
      for (const line of po.lines) {
        initial[line.id] = String(line.quantity);
      }
      setReceivedQuantities(initial);
    }
  }, [po?.lines, receivedQuantities]);

  const isNew = useMemo(() => {
    if (!po) return false;
    const created = new Date(po.created_at).getTime();
    return Date.now() - created < 10000;
  }, [po]);

  const canCancel = po?.status === 'draft' || po?.status === 'ordered';
  const isOrdered = po?.status === 'ordered';
  const isDraft = po?.status === 'draft';
  const isReceived = po?.status === 'received';

  const receivedLineCount = useMemo(() => {
    return Object.values(receivedQuantities).filter(
      (qty) => Number(qty) > 0,
    ).length;
  }, [receivedQuantities]);

  const handleReceivedQtyChange = (lineId: string, qty: string) => {
    setReceivedQuantities((prev) => ({ ...prev, [lineId]: qty }));
  };

  // Mark as Ordered mutation
  const orderMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/purchase-orders/${id}`, { status: 'ordered' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order marked as ordered.');
    },
    onError: () => toast.error('Failed to update purchase order status.'),
  });

  // Receive mutation
  const receiveMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/purchase-orders/${id}/receive`, {
        lines: Object.entries(receivedQuantities)
          .filter(([_, qty]) => Number(qty) > 0)
          .map(([lineId, qty]) => ({
            id: lineId,
            received_quantity: Number(qty),
          })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Receiving recorded. Stock levels updated.');
      setReceiveDialogOpen(false);
    },
    onError: () =>
      toast.error(
        'Failed to record receiving. Stock levels were not updated. Try again or contact your administrator.',
      ),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => apiClient.post(`/purchase-orders/${id}/cancel`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order cancelled.');
      router.push('/operations/purchase-orders');
    },
    onError: () => toast.error('Failed to cancel purchase order.'),
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground p-6">
        Loading purchase order...
      </div>
    );
  }

  if (isError || !po) {
    return (
      <div className="text-sm text-destructive p-6">
        Purchase order not found or failed to load.
      </div>
    );
  }

  const headerCard = (
    <MagicCard gradientColor="#1a1a2e" className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {po.vendor?.name ?? 'Unknown Vendor'}
          </h2>
          <div className="flex items-center gap-2">
            <Badge
              className={`text-xs border-0 ${PO_STATUS_BADGE_CLASSES[po.status as PurchaseOrderStatus]}`}
            >
              {PO_STATUS_LABELS[po.status as PurchaseOrderStatus]}
            </Badge>
            {po.zone?.name && (
              <span className="text-xs text-muted-foreground">
                {po.zone.name}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {po.ordered_at
              ? `Ordered ${formatDate(po.ordered_at)}`
              : `Created ${formatDate(po.created_at)}`}
          </p>
          {isReceived && po.received_at && (
            <p className="text-xs text-muted-foreground">
              Received {formatDate(po.received_at)}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-xl font-semibold">
            ₹{Number(po.total_amount).toLocaleString('en-IN')}
          </p>
          {po.ordered_by_user?.name && (
            <p className="text-xs text-muted-foreground mt-1">
              by {po.ordered_by_user.name}
            </p>
          )}
        </div>
      </div>
      {po.notes && (
        <p className="mt-3 text-sm text-muted-foreground border-t pt-3">
          {po.notes}
        </p>
      )}
    </MagicCard>
  );

  return (
      <div className="space-y-6 max-w-4xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/operations/purchase-orders"
            className="hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-4" />
            Purchase Orders
          </Link>
          <span>/</span>
          <span className="text-foreground">PO #{id.slice(0, 8)}</span>
        </div>

        {/* PO header card */}
        {isNew ? (
          <div className="relative rounded-xl">
            <ShineBorder
              shineColor={['#4ade80', '#22d3ee']}
              borderWidth={1}
            />
            {headerCard}
          </div>
        ) : (
          headerCard
        )}

        {/* Read-only line items table */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Line Items</h3>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Ingredient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Ordered Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Unit Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Line Total
                  </th>
                  {isReceived && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Received Qty
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {po.lines?.map((line) => (
                  <tr
                    key={line.id}
                    className="border-b last:border-b-0"
                  >
                    <td className="px-4 py-2 text-sm font-medium">
                      {line.ingredient?.name ?? '\u2014'}
                    </td>
                    <td className="px-4 py-2 font-mono text-sm text-muted-foreground">
                      {line.quantity} {line.unit}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      INR{' '}
                      {Number(line.unit_cost).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2 font-mono text-sm text-muted-foreground">
                      INR{' '}
                      {(
                        Number(line.quantity) * Number(line.unit_cost)
                      ).toLocaleString('en-IN')}
                    </td>
                    {isReceived && (
                      <td className="px-4 py-2 font-mono text-sm text-green-400">
                        {line.received_quantity ?? '\u2014'} {line.unit}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Draft actions: Mark as Ordered */}
        {isDraft && (
          <div className="flex items-center gap-3">
            <Button
              onClick={() => orderMutation.mutate()}
              disabled={orderMutation.isPending}
            >
              {orderMutation.isPending
                ? 'Updating...'
                : 'Mark as Ordered'}
            </Button>
          </div>
        )}

        {/* Receiving section (only for ordered POs) */}
        {isOrdered && po.lines && po.lines.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Receive Items</h3>
            <div className="relative rounded-lg border overflow-hidden">
              <BorderBeam size={150} duration={8} />
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Ingredient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Ordered Qty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Unit Cost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Line Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Received Qty
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((line) => (
                    <ReceivingLineRow
                      key={line.id}
                      line={line}
                      receivedQty={
                        receivedQuantities[line.id] ?? String(line.quantity)
                      }
                      onReceivedQtyChange={handleReceivedQtyChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              onClick={() => setReceiveDialogOpen(true)}
              disabled={receivedLineCount === 0 || receiveMutation.isPending}
            >
              Mark as Received
            </Button>
          </div>
        )}

        {/* Cancel button (draft or ordered) */}
        {canCancel && (
          <div className="pt-4 border-t">
            <Button
              variant="destructive"
              onClick={() => setCancelDialogOpen(true)}
              disabled={cancelMutation.isPending}
            >
              Cancel PO
            </Button>
          </div>
        )}

        {/* Receiving confirmation Dialog */}
        <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Receiving</DialogTitle>
              <DialogDescription>
                Confirm actual received quantities. This will update stock
                levels for {receivedLineCount} ingredient
                {receivedLineCount !== 1 ? 's' : ''} and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setReceiveDialogOpen(false)}
                disabled={receiveMutation.isPending}
              >
                Go Back
              </Button>
              <Button
                onClick={() => receiveMutation.mutate()}
                disabled={receiveMutation.isPending}
              >
                {receiveMutation.isPending
                  ? 'Processing...'
                  : 'Confirm Receive'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel confirmation Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Purchase Order</DialogTitle>
              <DialogDescription>
                Cancel this purchase order? This cannot be undone. Any ordered
                items will not be received.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
                disabled={cancelMutation.isPending}
              >
                Keep Order
              </Button>
              <Button
                variant="destructive"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Order'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
