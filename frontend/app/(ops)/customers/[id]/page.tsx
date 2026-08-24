'use client';

/**
 * `/customers/[id]` — one customer, whole (`OPS-04`, `MANAGE_OPS`).
 *
 * `GET /customers/:id` fans out five bounded queries in one response — profile,
 * `orders_summary`, and recent slices of `orders`, `loyalty_transactions`,
 * `coupon_redemptions` and `reviews` — so this route needs exactly one request
 * and every panel reads from the same cache entry. Each write on the screen
 * invalidates `['customers', id]`, and the whole profile reconciles from the
 * server rather than from a local guess (P5b decision 24).
 *
 * The slices are capped at 50 rows each; `_count` carries the real totals, which
 * is why the tab labels count from `_count` and each panel states "N of M".
 */

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, UserX } from 'lucide-react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient, apiErrorStatus } from '@/lib/api-client';
import { customerLabel, type CustomerDetail } from '@/lib/types/customers';
import { CustomerProfileHeader } from '@/components/ops/customers/CustomerProfileHeader';
import { CustomerOrdersPanel } from '@/components/ops/customers/CustomerOrdersPanel';
import { CustomerLoyaltyPanel } from '@/components/ops/customers/CustomerLoyaltyPanel';
import { CustomerReviewsPanel } from '@/components/ops/customers/CustomerReviewsPanel';
import { CustomerAddressesPanel } from '@/components/ops/customers/CustomerAddressesPanel';
import { CustomerCouponsPanel } from '@/components/ops/customers/CustomerCouponsPanel';

type PanelKey = 'orders' | 'loyalty' | 'reviews' | 'addresses' | 'coupons';

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-8 w-full max-w-lg rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

export default function CustomerDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const [tab, setTab] = useState<PanelKey>('orders');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['customers', id],
    queryFn: () => apiClient.get<CustomerDetail>(`/customers/${id}`),
  });

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    // A bad id is a wrong turn, not a fault — it gets its own copy and a way back.
    const notFound = apiErrorStatus(error) === 404;
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/customers" />}
        >
          <ArrowLeft />
          All customers
        </Button>
        <Alert variant={notFound ? 'default' : 'destructive'}>
          {notFound ? (
            <UserX className="size-4" />
          ) : (
            <AlertCircle className="size-4" />
          )}
          <AlertTitle>
            {notFound ? 'No such customer' : 'Could not load this customer'}
          </AlertTitle>
          <AlertDescription>
            {notFound
              ? 'This customer does not exist, or the link is out of date.'
              : 'The profile did not come back. Nothing has been changed.'}
          </AlertDescription>
          {!notFound && (
            <AlertAction>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </AlertAction>
          )}
        </Alert>
      </div>
    );
  }

  const tabs: { value: PanelKey; label: string }[] = [
    { value: 'orders', label: `Orders (${data._count.orders})` },
    { value: 'loyalty', label: `Loyalty (${data.loyalty_transactions.length})` },
    { value: 'reviews', label: `Reviews (${data._count.reviews})` },
    { value: 'addresses', label: `Addresses (${data.addresses.length})` },
    { value: 'coupons', label: `Coupons (${data._count.coupon_redemptions})` },
  ];

  return (
    <div className="space-y-6">
      <CustomerProfileHeader customer={data} />

      <Tabs value={tab} onValueChange={(value) => setTab(value as PanelKey)}>
        <TabsList className="max-w-full overflow-x-auto">
          {tabs.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value}>
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="orders" className="pt-4">
          <CustomerOrdersPanel
            orders={data.orders}
            totalOrders={data._count.orders}
          />
        </TabsContent>

        <TabsContent value="loyalty" className="pt-4">
          <CustomerLoyaltyPanel
            customerId={data.id}
            customerName={customerLabel(data)}
            account={data.loyalty_account}
            transactions={data.loyalty_transactions}
          />
        </TabsContent>

        <TabsContent value="reviews" className="pt-4">
          <CustomerReviewsPanel
            reviews={data.reviews}
            totalReviews={data._count.reviews}
          />
        </TabsContent>

        <TabsContent value="addresses" className="pt-4">
          <CustomerAddressesPanel addresses={data.addresses} />
        </TabsContent>

        <TabsContent value="coupons" className="pt-4">
          <CustomerCouponsPanel
            redemptions={data.coupon_redemptions}
            totalRedemptions={data._count.coupon_redemptions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
