'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PurchaseOrderRow } from '@/components/ops/operations/purchase-orders/PurchaseOrderRow';
import { apiClient } from '@/lib/api-client';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/lib/types/purchase-order';
import { ExportButton } from '@/components/ops/exports/ExportButton';

type StatusFilter = 'all' | PurchaseOrderStatus;

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [cancellingPo, setCancellingPo] = useState<PurchaseOrder | null>(null);

  const {
    data: purchaseOrders,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => apiClient.get<PurchaseOrder[]>('/purchase-orders'),
  });

  const cancelMutation = useMutation({
    mutationFn: (poId: string) =>
      apiClient.post(`/purchase-orders/${poId}/cancel`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order cancelled.');
      setCancellingPo(null);
    },
    onError: () => toast.error('Failed to cancel purchase order.'),
  });

  const filteredPOs = useMemo(() => {
    if (!purchaseOrders) return [];
    if (statusFilter === 'all') return purchaseOrders;
    return purchaseOrders.filter((po) => po.status === statusFilter);
  }, [purchaseOrders, statusFilter]);

  const emptyHeading =
    statusFilter === 'all'
      ? 'No Purchase Orders'
      : `No ${statusFilter} orders`;

  const emptyMessage =
    statusFilter === 'all'
      ? 'Create your first purchase order to start tracking procurement.'
      : `No ${statusFilter} purchase orders found. Try a different filter.`;

  return (
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <div className="flex items-center gap-2">
            <ExportButton
              reportType="purchase_orders"
              reportName="Purchase Orders"
              isTimeSeries={true}
            />
            <Link href="/operations/purchase-orders/new">
              <Button>New Purchase Order</Button>
            </Link>
          </div>
        </div>

        {/* Status tabs */}
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <TabsList className="overflow-x-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="ordered">Ordered</TabsTrigger>
            <TabsTrigger value="received">Received</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Loading / Error */}
        {isLoading && (
          <div className="text-sm text-muted-foreground">
            Loading purchase orders...
          </div>
        )}
        {isError && (
          <div className="text-sm text-destructive">
            Something went wrong. Refresh the page or try again in a moment.
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && filteredPOs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <ClipboardList className="size-12 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold">{emptyHeading}</h2>
            <p className="text-sm text-muted-foreground max-w-md">{emptyMessage}</p>
          </div>
        )}

        {/* PO Table */}
        {!isLoading && !isError && filteredPOs.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Ordered At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPOs.map((po) => (
                  <PurchaseOrderRow
                    key={po.id}
                    po={po}
                    onCancel={setCancellingPo}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cancel PO confirmation Dialog */}
        <Dialog
          open={!!cancellingPo}
          onOpenChange={(open) => {
            if (!open) setCancellingPo(null);
          }}
        >
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
                onClick={() => setCancellingPo(null)}
                disabled={cancelMutation.isPending}
              >
                Keep Order
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (cancellingPo) {
                    cancelMutation.mutate(cancellingPo.id);
                  }
                }}
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
