'use client';

/**
 * `GET /customers` rendered as a table (`OPS-04`).
 *
 * The columns are the ones the plan names: identity, contact, loyalty balance +
 * tier, the three relation counts, marketing consent and `last_seen_at`.
 *
 * **Navigation is a real `<a>`, not a row `onClick`.** The whole row is
 * clickable for the mouse, but the name cell carries the link so the keyboard
 * and the middle mouse button work and so the destination shows in the status
 * bar. `_count` comes straight from the API, so a customer with no orders reads
 * `0` rather than an empty cell.
 */

import Link from 'next/link';
import { ChevronRight, Users } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format/date';
import { customerLabel, type CustomerSummary } from '@/lib/types/customers';
import {
  LoyaltyTierBadge,
  MarketingOptInBadge,
} from '@/components/ops/customers/MarketingOptInBadge';
import { formatPoints } from '@/components/ops/customers/CustomerPanel';

const COLUMN_COUNT = 7;

interface CustomerTableProps {
  customers: CustomerSummary[];
  isLoading: boolean;
  /** Set when a search returned nothing, so the empty state can say what was searched. */
  query?: string;
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, row) => (
        <TableRow key={row}>
          {Array.from({ length: COLUMN_COUNT }).map((__, cell) => (
            <TableCell key={cell}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function CustomerTable({ customers, isLoading, query }: CustomerTableProps) {
  const showEmpty = !isLoading && customers.length === 0;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Customer</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead className="text-right">Points</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead className="hidden sm:table-cell text-right">
              Orders · Reviews · Bookings
            </TableHead>
            <TableHead className="hidden lg:table-cell">Marketing</TableHead>
            <TableHead className="hidden lg:table-cell">Last seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <LoadingRows />}

          {showEmpty && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="py-16">
                <div className="space-y-2 text-center">
                  <Users className="mx-auto size-6 text-muted-foreground" aria-hidden />
                  <h3 className="text-base font-medium">
                    {query ? 'No customer matches that search' : 'No customers yet'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {query
                      ? `Nothing came back for “${query}”. Search matches phone, name and email.`
                      : 'Anyone who orders from the storefront or checks out at the POS appears here.'}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}

          {customers.map((customer) => {
            const href = `/customers/${customer.id}`;
            return (
              <TableRow key={customer.id} className="group/row">
                <TableCell>
                  <Link
                    href={href}
                    className="flex items-center gap-2 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {customerLabel(customer)}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {customer.phone}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100"
                      aria-hidden
                    />
                  </Link>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {customer.email ?? '—'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {customer.loyalty_account
                    ? formatPoints(customer.loyalty_account.points_balance)
                    : '—'}
                </TableCell>
                <TableCell>
                  <LoyaltyTierBadge tier={customer.loyalty_account?.tier ?? null} />
                </TableCell>
                <TableCell className="hidden sm:table-cell text-right font-mono text-sm">
                  <span title="Orders · Reviews · Bookings">
                    {customer._count.orders} · {customer._count.reviews} ·{' '}
                    {customer._count.bookings}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <MarketingOptInBadge optedIn={customer.marketing_opt_in} />
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {formatDateTime(customer.last_seen_at)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
