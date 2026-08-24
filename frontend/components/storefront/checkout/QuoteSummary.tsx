'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, Home, Package, Ticket } from 'lucide-react';

import { MoneyLine } from '@/components/storefront/common/MoneyLine';
import { assertQuoteTotal, formatCurrency, formatTaxRate } from '@/lib/format/currency';
import { formatEtd } from '@/lib/format/date';
import { groupQuoteLines, type Quote, type QuoteLine } from '@/lib/types/checkout';
import type { FulfilmentType } from '@/lib/types/catalog';
import { cn } from '@/lib/utils';

/**
 * The frozen price, rendered from the real object.
 *
 * ## The one money rule this component exists to enforce
 *
 * `total = subtotal − discount_amount − loyalty.redeem_amount + shipping_amount`.
 *
 * **`tax_amount` is not a term.** `Quote.subtotal` is the tax-*inclusive* gross
 * and `tax_amount` is the GST already carved out of it, so GST renders through
 * `<MoneyLine variant="of-which">` — indented, quieter, prefixed "of which" —
 * and never as a `+` line. That is the only shape `MoneyLine` will give it, and
 * `assertQuoteTotal` throws in development the moment a rendered total stops
 * matching the formula. A regression here double-charges GST on every order,
 * which is why it is an invariant and not a comment.
 *
 * ## The discount is two lines, never one
 *
 * P5a decision 23: the coupon and the loyalty burn are separate terms with
 * separate provenance, so they get separate rows. `Order.discount_amount` bundles
 * them into one column downstream, and the receipt reconstructs the split — but
 * a customer looking at a quote should see which of the two took the money off.
 */

const GROUP_META: Record<FulfilmentType, { label: string; icon: typeof Home; hint: string }> = {
  local: { label: 'From the villa', icon: Home, hint: 'Made fresh and delivered or collected' },
  shipped: { label: 'Shipped to you', icon: Package, hint: 'Sent by courier' },
  booking: { label: 'Experiences', icon: Ticket, hint: 'Attended at the villa' },
};

const GROUP_ORDER: FulfilmentType[] = ['local', 'shipped', 'booking'];

function LineRow({ line }: { line: QuoteLine }) {
  return (
    <li className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{line.name}</p>
        <p className="text-xs text-ink-muted tabular-nums">
          {line.quantity} × {formatCurrency(line.unit_price)}
          {line.sku ? <span className="text-ink-faint"> · {line.sku}</span> : null}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium text-ink tabular-nums">
        {formatCurrency(line.gross)}
      </span>
    </li>
  );
}

export interface QuoteSummaryProps {
  quote: Quote;
  /** Rendered above the totals — the countdown, in the sticky column. */
  header?: React.ReactNode;
  /** Rendered below the totals — the Pay button, in the sticky column. */
  footer?: React.ReactNode;
  /** `false` in the compact mobile bar, where only the totals are wanted. */
  showLines?: boolean;
  className?: string;
}

export function QuoteSummary({
  quote,
  header,
  footer,
  showLines = true,
  className,
}: QuoteSummaryProps) {
  const [showTaxBreakup, setShowTaxBreakup] = useState(false);

  // Dev-only, once per render of the whole quote — not per line.
  assertQuoteTotal(quote);

  const groups = groupQuoteLines(quote.lines);
  const redeem = quote.loyalty.redeem_amount;
  const etd = quote.shipping?.etd ? formatEtd(quote.shipping.etd) : null;

  return (
    <div
      data-slot="quote-summary"
      className={cn('rounded-2xl border border-line bg-surface p-5', className)}
    >
      {header ? <div className="mb-4">{header}</div> : null}

      {showLines ? (
        <div className="space-y-4">
          {GROUP_ORDER.map((key) => {
            const lines = groups[key];
            if (lines.length === 0) return null;
            const { label, icon: Icon, hint } = GROUP_META[key];
            return (
              <section key={key}>
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </h3>
                <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>
                <ul className="mt-1 divide-y divide-line">
                  {lines.map((line) => (
                    <LineRow key={`${line.product_id}:${line.variant_id ?? 'base'}`} line={line} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      {quote.rejected.length > 0 ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-strong">
            <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
            {quote.rejected.length === 1
              ? 'One item could not be included'
              : `${quote.rejected.length} items could not be included`}
          </p>
          <ul className="mt-2 space-y-1">
            {quote.rejected.map((line) => (
              <li
                key={`${line.product_id}:${line.variant_id ?? 'base'}`}
                className="text-sm text-ink-subtle"
              >
                <span className="font-medium text-ink">{line.name}</span> — {line.reason}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">
            They are not in the price below and you will not be charged for them.
          </p>
        </div>
      ) : null}

      <div className={cn('space-y-2', showLines || quote.rejected.length > 0 ? 'mt-5 border-t border-line pt-4' : '')}>
        <MoneyLine label="Subtotal (incl. GST)" value={quote.subtotal} />

        {/* GST is *inside* the subtotal above. Never a `+` line — see the header. */}
        <div>
          <MoneyLine label="GST" value={quote.tax_amount} variant="of-which" />
          {quote.tax_breakup.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setShowTaxBreakup((open) => !open)}
                aria-expanded={showTaxBreakup}
                className="mt-1 ml-3 flex items-center gap-1 text-xs text-ink-faint underline underline-offset-2 hover:text-ink-muted"
              >
                {showTaxBreakup ? 'Hide' : 'Show'} GST rates
                <ChevronDown
                  className={cn('size-3 transition-transform', showTaxBreakup && 'rotate-180')}
                  aria-hidden="true"
                />
              </button>
              {showTaxBreakup ? (
                <ul className="mt-1.5 ml-3 space-y-1">
                  {quote.tax_breakup.map((row) => (
                    <li
                      key={row.rate}
                      className="flex items-baseline justify-between gap-4 text-xs text-ink-faint"
                    >
                      <span>
                        {formatTaxRate(row.rate)} on {formatCurrency(row.taxable)}
                      </span>
                      <span className="tabular-nums">{formatCurrency(row.tax)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>

        {quote.coupon ? (
          <MoneyLine
            label={`Coupon ${quote.coupon.code}`}
            value={quote.discount_amount}
            sign="minus"
          />
        ) : null}

        {/* Separate from the coupon by design (P5a decision 23) — never merged. */}
        {redeem > 0 ? (
          <MoneyLine
            label="Loyalty points"
            value={redeem}
            sign="minus"
            note={`${quote.loyalty.points_applied.toLocaleString('en-IN')} points redeemed`}
          />
        ) : null}

        {quote.shipping || quote.shipping_amount > 0 ? (
          <MoneyLine
            label="Shipping"
            value={quote.shipping_amount}
            valueOverride={quote.shipping_amount === 0 ? 'Free' : undefined}
            note={
              quote.shipping?.courier_name
                ? `${quote.shipping.courier_name}${etd ? `, arriving ${etd}` : ''}`
                : etd
                  ? `Arriving ${etd}`
                  : undefined
            }
          />
        ) : null}

        <MoneyLine label="Total" value={quote.total} variant="total" className="mt-1" />
      </div>

      {footer ? <div className="mt-5">{footer}</div> : null}
    </div>
  );
}
