'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DailyRevenueSummary } from '@/components/ops/pos/DailyRevenueSummary';
import { OrderHistoryTable } from '@/components/ops/pos/OrderHistoryTable';
import { apiClient } from '@/lib/api-client';
import type { Order, DailySummary } from '@/lib/types/orders';
import type { OrderStatus, OrderChannel, PaymentMethod } from '@/lib/types/kds';
import { ORDER_CHANNEL_LABELS, ORDER_STATUS_LABELS } from '@/lib/types/kds';
import { PAYMENT_METHOD_LABELS } from '@/lib/types/orders';
import { ExportButton } from '@/components/ops/exports/ExportButton';

// Filter options are derived from the enum label maps so a new Prisma member
// cannot silently go missing from a dropdown.
const CHANNEL_OPTIONS = Object.entries(ORDER_CHANNEL_LABELS) as [OrderChannel, string][];
const STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][];
const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS) as [
  PaymentMethod,
  string,
][];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildQueryString(filters: {
  dateFrom: string;
  dateTo: string;
  channel: string;
  status: string;
  paymentMethod: string;
  search: string;
}): string {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.status) params.set('status', filters.status);
  if (filters.paymentMethod) params.set('payment_method', filters.paymentMethod);
  if (filters.search) params.set('search', filters.search);
  return params.toString();
}

export default function OrderHistoryPage() {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({ dateFrom, dateTo, channel, status, paymentMethod, search }),
    [dateFrom, dateTo, channel, status, paymentMethod, search],
  );

  const dateStr = todayStr();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['orders', 'daily-summary', dateStr],
    queryFn: () =>
      apiClient.get<DailySummary>('/orders/daily-summary?date=' + dateStr),
  });

  const {
    data: orders,
    isLoading: ordersLoading,
    isError: ordersError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () =>
      apiClient.get<Order[]>('/orders?' + buildQueryString(filters)),
  });

  return (
    <>
      <div className="space-y-6">
        {/* Page header */}
        <h1 className="text-2xl font-bold">Order History</h1>

        {/* Daily revenue summary */}
        <DailyRevenueSummary summary={summary} isLoading={summaryLoading} />

        {/* Filter bar */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Channel</label>
            <Select
              value={channel}
              onValueChange={(v: string | null) => setChannel(v ?? '')}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                {CHANNEL_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Status</label>
            <Select
              value={status}
              onValueChange={(v: string | null) => setStatus(v ?? '')}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                {STATUS_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Payment</label>
            <Select
              value={paymentMethod}
              onValueChange={(v: string | null) => setPaymentMethod(v ?? '')}
            >
              <SelectTrigger className="w-28">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                {PAYMENT_METHOD_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[180px]">
            <label className="text-xs font-bold text-muted-foreground">Search</label>
            <Input
              type="text"
              placeholder="Search by order #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ExportButton
            reportType="orders"
            reportName="Orders"
            isTimeSeries={true}
            currentFilters={{ channel, status, dateFrom, dateTo }}
          />
        </div>

        {/* Orders table */}
        {ordersError ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Could not load orders</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              The order history failed to load for the selected filters.
              <Button variant="outline" size="sm" onClick={() => void refetchOrders()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <OrderHistoryTable
            orders={orders ?? []}
            isLoading={ordersLoading}
            // P5b decision 8: the detail is a route, not a sheet. Selecting a
            // row navigates to `/pos/orders/[id]`, which keeps the refund
            // ledger, the shipment link and the lifecycle actions linkable,
            // reloadable and back-button-able.
            onSelectOrder={(order) => router.push(`/pos/orders/${order.id}`)}
          />
        )}
      </div>
    </>
  );
}
