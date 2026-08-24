'use client';

/**
 * The identity block at the top of `/customers/[id]`, plus the marketing
 * consent toggle — the only staff-side write on `Customer`
 * (`PATCH /customers/:id { marketing_opt_in }`).
 *
 * **The toggle asks first.** `customers.service.ts` writes an `AuditEvent`
 * (`customer.marketing_opt_in_changed`) for every flip, because consent is
 * exactly the kind of fact a regulator asks about a year later — so a stray
 * click on a switch must not be able to change it silently.
 *
 * **And it is not optimistic** (P5b decision 24): no staff mutation on the
 * money or consent path renders its own guess. The switch shows a pending
 * state and the badge only moves once the server has answered.
 *
 * `orders_summary.lifetime_value` sums `Order.total`, which is **GST-inclusive**
 * (P5a decision 1) — `tax_amount` is carved out of `subtotal`, never added, so
 * no figure on this screen adds tax to a total.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, ArrowLeft, Loader2, Mail, Phone } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format/currency';
import { formatDate, formatDateTime } from '@/lib/format/date';
import {
  customerLabel,
  type CustomerDetail,
  type UpdateCustomerPayload,
} from '@/lib/types/customers';
import { MarketingOptInBadge } from '@/components/ops/customers/MarketingOptInBadge';

/** Two-letter monogram; falls back to the phone when the customer has no name. */
function initials(customer: CustomerDetail): string {
  const name = customer.name?.trim();
  if (!name) return customer.phone.slice(-2);
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

interface StatProps {
  label: string;
  value: string;
  hint?: string;
}

function Stat({ label, value, hint }: StatProps) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface CustomerProfileHeaderProps {
  customer: CustomerDetail;
}

export function CustomerProfileHeader({ customer }: CustomerProfileHeaderProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const next = !customer.marketing_opt_in;

  const mutation = useMutation({
    mutationFn: (payload: UpdateCustomerPayload) =>
      apiClient.patch(`/customers/${customer.id}`, payload),
    // The toast reads from the payload, not from `next`, so it can never
    // describe a different flip from the one that was actually sent.
    onSuccess: async (_data, payload) => {
      setConfirmOpen(false);
      toast.success(
        payload.marketing_opt_in
          ? 'Marketing consent recorded — this customer can be emailed.'
          : 'Marketing consent withdrawn — this customer will not be emailed.',
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customers', customer.id] }),
        queryClient.invalidateQueries({ queryKey: ['customers', 'list'] }),
      ]);
    },
  });

  const summary = customer.orders_summary;

  return (
    <>
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

        <Card>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-12">
                  <AvatarFallback>{initials(customer)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <h1 className="truncate text-2xl font-bold">
                    {customerLabel(customer)}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3.5" aria-hidden />
                      <span className="font-mono">{customer.phone}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Mail className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{customer.email ?? 'No email'}</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Customer since {formatDate(customer.created_at)} · last seen{' '}
                    {formatDateTime(customer.last_seen_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MarketingOptInBadge optedIn={customer.marketing_opt_in} />
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="marketing-opt-in"
                    className="text-xs text-muted-foreground"
                  >
                    Marketing
                  </Label>
                  <Switch
                    id="marketing-opt-in"
                    checked={customer.marketing_opt_in}
                    disabled={mutation.isPending}
                    // Base UI fires this with the value the switch *would* take;
                    // the write happens only after the confirm dialog.
                    onCheckedChange={() => setConfirmOpen(true)}
                    aria-label={
                      customer.marketing_opt_in
                        ? 'Withdraw marketing consent'
                        : 'Record marketing consent'
                    }
                  />
                  {mutation.isPending && (
                    <Loader2
                      className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
                      aria-label="Saving"
                    />
                  )}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
              <Stat
                label="Lifetime value"
                value={formatCurrency(summary.lifetime_value)}
                hint="Incl. GST · billable orders only"
              />
              <Stat
                label="Orders"
                value={String(summary.total_orders)}
                hint={`${summary.billable_orders} billable`}
              />
              <Stat
                label="Last order"
                value={
                  summary.last_order_at ? formatDate(summary.last_order_at) : 'Never'
                }
              />
              <Stat
                label="Reviews · Bookings"
                value={`${customer._count.reviews} · ${customer._count.bookings}`}
                hint={`${customer._count.coupon_redemptions} coupon redemptions`}
              />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {next ? 'Record marketing consent?' : 'Withdraw marketing consent?'}
            </DialogTitle>
            <DialogDescription>
              {next
                ? `${customerLabel(customer)} will be included in marketing emails and campaigns.`
                : `${customerLabel(customer)} will be excluded from marketing emails and campaigns. Order and delivery notifications are unaffected.`}
            </DialogDescription>
          </DialogHeader>
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                {apiErrorMessage(
                  mutation.error,
                  'The consent change did not save. Nothing has been changed.',
                )}
              </AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-muted-foreground">
            The change is recorded in the audit log against your account. Only do
            this when the customer has actually told you.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => mutation.mutate({ marketing_opt_in: next })}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Saving…
                </>
              ) : next ? (
                'Opt in'
              ) : (
                'Opt out'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
