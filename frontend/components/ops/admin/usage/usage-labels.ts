/**
 * Label helpers shared by the `/admin/usage` pieces.
 *
 * `UsageEvent.role_code` is a plain string, not an enum: it holds whatever role
 * the caller carried at event time, plus the synthetic `CUSTOMER` code the
 * storefront records under. So neither `ROLE_DISPLAY_NAMES` nor a title-caser is
 * enough on its own — this is the fallback chain both need.
 */

import { formatDate } from '@/lib/format/date';
import { CUSTOMER_ROLE_CODE } from '@/lib/types/usage';
import { ROLE_DISPLAY_NAMES, RoleCode } from '@/lib/types/roles';

/** The five-stop brand ramp from `globals.css` — never a raw hue (DESIGN-02). */
export const USAGE_CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

/**
 * A readable name for a recorded role code.
 *
 * `CUSTOMER` is not a `Role` — it is how storefront traffic is stamped — so it
 * gets prose rather than a title-cased code, which is the distinction the
 * dashboard has to make visible.
 */
export function usageRoleLabel(roleCode: string): string {
  if (roleCode === CUSTOMER_ROLE_CODE) return 'Storefront visitors';
  const known = ROLE_DISPLAY_NAMES[roleCode as RoleCode];
  if (known) return known;
  return roleCode
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/** True for the synthetic storefront role, which never appears in `by_user`. */
export function isCustomerRole(roleCode: string): boolean {
  return roleCode === CUSTOMER_ROLE_CODE;
}

/**
 * `task.status_change` → `Task · status change`. The action vocabulary is a
 * closed dotted list (`USAGE_ACTIONS`), so splitting on the dot is safe and the
 * result stays greppable back to the constant.
 */
export function usageActionLabel(action: string): string {
  const [namespace, ...rest] = action.split('.');
  const head = namespace.replace(/_/g, ' ');
  const tail = rest.join('.').replace(/_/g, ' ');
  const title = head.charAt(0).toUpperCase() + head.slice(1);
  return tail ? `${title} · ${tail}` : title;
}

/** Whole numbers, Indian grouping — every usage count is a raw integer. */
export function formatCount(value: number): string {
  return value.toLocaleString('en-IN');
}

/**
 * A `YYYY-MM-DD` node-local day key → `1 Aug 2026`.
 *
 * Anchored at **UTC** midnight before formatting. `lib/format/date` pins
 * `Asia/Kolkata`, so a bare `T00:00:00` — parsed in the viewer's zone — would
 * render the previous day for anyone east of IST. `Z` makes the instant
 * absolute and the pinned formatter then lands on the intended calendar day
 * from any browser.
 */
export function formatDayKey(day: string): string {
  return formatDate(`${day}T00:00:00Z`);
}
