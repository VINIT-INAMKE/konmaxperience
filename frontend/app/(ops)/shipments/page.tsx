'use client';

/**
 * `OPS-03` — the staff parcel desk. Two tabs, because packing and tracking are
 * two different jobs done by two different people at two different moments:
 *
 * - **To pack** — orders with shipped lines that have **no `Shipment` row**.
 *   Not `OrderItemStatus.packed`: `confirm` sets that on every shipped line
 *   before anyone has touched a box (P5b decision 10), so that predicate would
 *   show an empty queue over a full bench.
 * - **Shipments** — every parcel that exists, filtered by `ShipmentStatus`.
 *
 * Both tabs ride `private-shipments`. `shipment.updated` fires from the staff
 * buttons *and* from the Shiprocket webhook, so a courier scan moves a row here
 * with no reload, and the 30 s poll carries the screen whenever the socket is
 * missing or refused (`IA-07`).
 */

import { useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Lock, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Permission } from '@/lib/types/permissions';
import {
  SHIPMENTS_KEY,
  useShipmentsRealtime,
} from '@/lib/hooks/use-shipments-realtime';
import {
  LiveIndicator,
  ShipmentFilterBar,
  type ShipmentStatusFilter,
} from '@/components/ops/shipments/ShipmentFilterBar';
import { ShipmentsTable } from '@/components/ops/shipments/ShipmentsTable';
import { ToPackQueue } from '@/components/ops/shipments/ToPackQueue';

type ShipmentsTab = 'to-pack' | 'shipments';

export default function ShipmentsPage() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.permissions);
  const canManage = permissions.includes(Permission.MANAGE_OPS);

  const [tab, setTab] = useState<ShipmentsTab>('to-pack');
  const [status, setStatus] = useState<ShipmentStatusFilter>('all');

  const { live } = useShipmentsRealtime();
  const isFetching = useIsFetching({ queryKey: SHIPMENTS_KEY }) > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Shipments
          </h1>
          <p className="max-w-prose text-sm text-ink-muted">
            Pack the orders that need a box, put a waybill on them, and watch
            them travel.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator live={live} />
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY })
            }
          >
            <RefreshCw
              className={`size-3.5 ${isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </header>

      {!canManage ? (
        <Alert>
          <Lock className="size-4" />
          <AlertTitle>Shipments needs the operations permission</AlertTitle>
          <AlertDescription>
            Every route behind this screen is gated by <code>MANAGE_OPS</code>.
            Ask an administrator to add it to your role.
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value: unknown) => setTab(String(value) as ShipmentsTab)}
        >
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList>
              <TabsTrigger value="to-pack">
                <PackageCheck className="size-4" />
                To pack
              </TabsTrigger>
              <TabsTrigger value="shipments">
                <Truck className="size-4" />
                Shipments
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="to-pack" className="pt-4">
            {tab === 'to-pack' && <ToPackQueue live={live} />}
          </TabsContent>

          <TabsContent value="shipments" className="space-y-4 pt-4">
            {tab === 'shipments' && (
              <>
                <ShipmentFilterBar status={status} onStatusChange={setStatus} />
                <ShipmentsTable status={status} live={live} />
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
