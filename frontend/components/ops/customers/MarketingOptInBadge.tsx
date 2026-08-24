'use client';

/**
 * The two badges the staff Customers screen shares between its list and its
 * detail route (`OPS-04`).
 *
 * `LoyaltyTierBadge` lives here rather than in `CustomerLoyaltyPanel` so
 * `/customers` can render a row without pulling `LoyaltyAdjustDialog` — and
 * with it `react-hook-form` and `zod` — into the list bundle.
 *
 * Colour comes from `STATUS_BADGE`, never from a palette hue: `tokens.css` is
 * the single source of colour and the ops app has a dark theme (DESIGN-02).
 */

import { BellOff, BellRing } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import { LOYALTY_TIER_LABELS, type LoyaltyTier } from '@/lib/types/checkout';
import { cn } from '@/lib/utils';

interface MarketingOptInBadgeProps {
  optedIn: boolean;
  className?: string;
}

/**
 * Consent is a fact about a person, so it is stated in words and not implied by
 * a bare colour: "Opted in" / "Opted out", each with its own icon.
 */
export function MarketingOptInBadge({
  optedIn,
  className,
}: MarketingOptInBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(optedIn ? STATUS_BADGE.good : STATUS_BADGE.neutral, className)}
    >
      {optedIn ? <BellRing aria-hidden /> : <BellOff aria-hidden />}
      {optedIn ? 'Opted in' : 'Opted out'}
    </Badge>
  );
}

/** `member` is the resting state, so it reads neutral; the tiers above it earn colour. */
const TIER_STYLES: Record<LoyaltyTier, string> = {
  member: STATUS_BADGE.neutral,
  regular: STATUS_BADGE.info,
  insider: STATUS_BADGE.good,
};

interface LoyaltyTierBadgeProps {
  /** `null` when the customer has never had a `LoyaltyAccount` row created. */
  tier: LoyaltyTier | null | undefined;
  className?: string;
}

export function LoyaltyTierBadge({ tier, className }: LoyaltyTierBadgeProps) {
  if (!tier) {
    return (
      <Badge variant="outline" className={cn(STATUS_BADGE.neutral, className)}>
        No account
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(TIER_STYLES[tier], className)}>
      {LOYALTY_TIER_LABELS[tier]}
    </Badge>
  );
}
