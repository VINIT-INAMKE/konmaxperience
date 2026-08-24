'use client';

import { AlertTriangle, Ban, Pencil, TicketPercent } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/format/currency';
import { formatDateTime } from '@/lib/format/date';
import { PRODUCT_TYPE_LABELS } from '@/lib/types/catalog';
import { COUPON_TYPE_LABELS, type Coupon } from '@/lib/types/promotions';
import { CouponStatusBadge } from './CouponStatusBadge';
import { CouponUsageCell } from './CouponUsageCell';

const EM_DASH = '—';
const INFINITY = '∞';
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e'];

const COLUMNS = [
  'Code',
  'Type',
  'Value',
  'Min order',
  'Max discount',
  'Applies to',
  'Window',
  'Usage',
  'Per customer',
  'Status',
] as const;

/** `value` means three different things depending on `type` — never one format. */
function renderValue(coupon: Coupon): string {
  switch (coupon.type) {
    case 'percent':
      return `${coupon.value}%`;
    case 'fixed':
      return formatCurrency(coupon.value);
    case 'free_shipping':
      return 'Shipping waived';
  }
}

interface CouponTableProps {
  coupons: Coupon[];
  isLoading: boolean;
  isError: boolean;
  /** The page's shared clock, so every badge in one render agrees. */
  now: number;
  onRetry: () => void;
  onCreate: () => void;
  onEdit: (coupon: Coupon) => void;
  onDisable: (coupon: Coupon) => void;
}

export function CouponTable({
  coupons,
  isLoading,
  isError,
  now,
  onRetry,
  onCreate,
  onEdit,
  onDisable,
}: CouponTableProps) {
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Could not load coupons</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          The promotions list did not come back. Nothing has changed.
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-line">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column} className="text-ink-muted">
                  {column}
                </TableHead>
              ))}
              <TableHead className="w-[92px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SKELETON_ROWS.map((row) => (
              <TableRow key={row}>
                {COLUMNS.map((column) => (
                  <TableCell key={column}>
                    <Skeleton className="h-4 w-full min-w-[56px]" />
                  </TableCell>
                ))}
                <TableCell>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (coupons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-line py-16 text-center">
        <TicketPercent className="size-10 text-ink-faint" aria-hidden />
        <div className="space-y-1">
          <h2 className="text-base font-medium text-ink">No coupons yet</h2>
          <p className="mx-auto max-w-[42ch] text-sm text-ink-muted">
            Create one to offer a discount at checkout. Coupons start as drafts,
            so nothing goes live until you say so.
          </p>
        </div>
        <Button onClick={onCreate}>New coupon</Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => (
              <TableHead key={column} className="whitespace-nowrap text-ink-muted">
                {column}
              </TableHead>
            ))}
            <TableHead className="w-[92px] text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coupons.map((coupon) => (
            <TableRow key={coupon.id}>
              <TableCell className="align-top">
                <div className="font-mono text-sm font-medium text-ink">
                  {coupon.code}
                </div>
                {coupon.description && (
                  <p className="mt-0.5 max-w-[26ch] truncate text-xs text-ink-muted">
                    {coupon.description}
                  </p>
                )}
              </TableCell>

              <TableCell className="align-top whitespace-nowrap text-sm text-ink-muted">
                {COUPON_TYPE_LABELS[coupon.type]}
              </TableCell>

              <TableCell className="align-top whitespace-nowrap text-sm tabular-nums">
                {renderValue(coupon)}
              </TableCell>

              <TableCell className="align-top whitespace-nowrap text-sm tabular-nums text-ink-muted">
                {coupon.min_order === null ? EM_DASH : formatCurrency(coupon.min_order)}
              </TableCell>

              <TableCell className="align-top whitespace-nowrap text-sm tabular-nums text-ink-muted">
                {coupon.type === 'percent' && coupon.max_discount !== null
                  ? formatCurrency(coupon.max_discount)
                  : EM_DASH}
              </TableCell>

              <TableCell className="align-top">
                {coupon.applies_to.length === 0 ? (
                  <span className="text-sm text-ink-muted">All types</span>
                ) : (
                  <div className="flex max-w-[180px] flex-wrap gap-1">
                    {coupon.applies_to.map((type) => (
                      <Badge key={type} variant="outline" className="font-normal">
                        {PRODUCT_TYPE_LABELS[type]}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>

              <TableCell className="align-top text-xs whitespace-nowrap text-ink-muted">
                <div>{formatDateTime(coupon.starts_at)}</div>
                <div className="text-ink-faint">
                  to {formatDateTime(coupon.ends_at)}
                </div>
              </TableCell>

              <TableCell className="align-top">
                <CouponUsageCell coupon={coupon} />
              </TableCell>

              <TableCell className="align-top text-sm tabular-nums text-ink-muted">
                {coupon.per_customer_limit === null
                  ? INFINITY
                  : coupon.per_customer_limit}
              </TableCell>

              <TableCell className="align-top">
                <CouponStatusBadge coupon={coupon} now={now} />
              </TableCell>

              <TableCell className="w-[92px] align-top text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(coupon)}
                    aria-label={`Edit coupon ${coupon.code}`}
                    title="Edit"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDisable(coupon)}
                    disabled={coupon.status === 'disabled'}
                    aria-label={`Disable coupon ${coupon.code}`}
                    title={
                      coupon.status === 'disabled'
                        ? 'Already disabled'
                        : 'Disable'
                    }
                  >
                    <Ban className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
