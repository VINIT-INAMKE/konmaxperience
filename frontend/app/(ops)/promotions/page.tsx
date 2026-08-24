'use client';

import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CouponSheet } from '@/components/ops/promotions/CouponSheet';
import { CouponTable } from '@/components/ops/promotions/CouponTable';
import { couponLifecycle } from '@/components/ops/promotions/CouponStatusBadge';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import type { Coupon, CouponsEnvelope } from '@/lib/types/promotions';

const PAGE_SIZE = 50;
/** The live/scheduled/expired badges are time-derived; re-read the clock each minute. */
const CLOCK_TICK_MS = 60_000;

const COUPONS_KEY = ['promotions', 'coupons'] as const;

function couponsPath(cursor: string | null): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  return `/promotions/coupons?${params.toString()}`;
}

/**
 * `OPS-02` — staff coupon administration (`MANAGE_OPS`).
 *
 * Two facts shape this screen and are deliberately visible in the UI rather
 * than only in the code:
 *
 * 1. **A discount is never computed here** (`PROMO-02`). This screen writes the
 *    *rules*; `CouponsService.evaluate` is the only place a rupee figure is
 *    derived from them, for the quote and for `POST /customer/coupons/validate`
 *    alike. Nothing on this page previews what a customer would save.
 * 2. **`DELETE` disables, it does not delete.** `CouponRedemption.coupon_id` is
 *    `onDelete: Restrict` and a redeemed coupon is part of an order's financial
 *    history, so the action is labelled "Disable", the row stays listed, and the
 *    confirm copy says the history is kept.
 */
export default function PromotionsPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | undefined>(undefined);
  const [pendingDisable, setPendingDisable] = useState<Coupon | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: COUPONS_KEY,
    queryFn: ({ pageParam }) =>
      apiClient.get<CouponsEnvelope>(couponsPath(pageParam)),
    initialPageParam: null as string | null,
    // The cursor is a row id the service echoes back; it is passed through
    // verbatim and never parsed (P5b decision 21).
    getNextPageParam: (lastPage: CouponsEnvelope) => lastPage.next_cursor,
  });

  const coupons = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const liveCount = useMemo(
    () => coupons.filter((c) => couponLifecycle(c, now) === 'live').length,
    [coupons, now],
  );

  const disable = useMutation({
    mutationFn: (coupon: Coupon) =>
      apiClient.delete<Coupon>(`/promotions/coupons/${coupon.id}`),
    onSuccess: (disabled) => {
      void queryClient.invalidateQueries({ queryKey: COUPONS_KEY });
      toast.success(`${disabled.code} disabled.`, {
        description: 'It stops working at checkout. Its redemptions are kept.',
      });
      setPendingDisable(null);
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, 'The coupon could not be disabled.'));
    },
  });

  const openCreate = () => {
    setEditing(undefined);
    setSheetOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-ink">Promotions</h1>
          <p className="text-sm text-ink-muted">
            Coupon codes customers can apply at checkout.{' '}
            {!isLoading && !isError && coupons.length > 0 && (
              <span className="text-ink-faint">
                {coupons.length} listed · {liveCount} live right now.
              </span>
            )}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New coupon
        </Button>
      </div>

      <CouponTable
        coupons={coupons}
        isLoading={isLoading}
        isError={isError}
        now={now}
        onRetry={() => void refetch()}
        onCreate={openCreate}
        onEdit={openEdit}
        onDisable={setPendingDisable}
      />

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                Loading…
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}

      <CouponSheet
        coupon={editing}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditing(undefined);
        }}
      />

      {/* Disable confirm — never a delete. */}
      <Dialog
        open={pendingDisable !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDisable(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Disable {pendingDisable?.code ?? 'this coupon'}?
            </DialogTitle>
            <DialogDescription>
              The code stops working at checkout immediately. It stays on this
              list as <span className="font-medium">Disabled</span>, and every
              redemption already made against it is kept — a redeemed coupon is
              part of an order&apos;s financial record and is never deleted. You
              can set it back to Active later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDisable(null)}
              disabled={disable.isPending}
            >
              Keep it active
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDisable) disable.mutate(pendingDisable);
              }}
              disabled={disable.isPending}
            >
              {disable.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Disabling…
                </>
              ) : (
                'Disable coupon'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
