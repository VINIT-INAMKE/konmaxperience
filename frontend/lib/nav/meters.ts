import { RoleCode } from '@/lib/types/roles';
import type { ReadinessMeter } from '@/lib/types/readiness';

/**
 * Which readiness meters a role is expected to move (SPEC §6.5, "my meter
 * contributions"). Matching is by meter *name*, substring, case-insensitive —
 * meter names are seeded reference data, codes are not stable across nodes.
 *
 * Lives beside `lib/nav/spine.ts` because it answers the same question that
 * file does — "what does this role look at" — and because two unrelated
 * surfaces read it: My Day's meter block and the meter chip on a task card.
 */
export const ROLE_METER_NAMES: Record<string, string[]> = {
  [RoleCode.BACKEND_LEAD]: ['Backend', 'Food', 'Standardization'],
  [RoleCode.FRONTEND_LEAD]: ['Frontend', 'Service'],
  [RoleCode.BI_LEAD]: ['Business Intelligence', 'Finance'],
  [RoleCode.PROCUREMENT_LEAD]: ['Procurement', 'Supply'],
  [RoleCode.TALENT_LEAD]: ['Talent', 'Hiring'],
  [RoleCode.TECH_LEAD]: ['Tech', 'Systems'],
  [RoleCode.DESIGN_OUTREACH_LEAD]: ['Design', 'Outreach', 'Brand'],
};

/** The whole-villa meter every role falls back to. */
const DEFAULT_METER_NAMES = ['Villa'];

export function getRelevantMeterNames(roleCode: string | undefined): string[] {
  if (!roleCode) return DEFAULT_METER_NAMES;
  return ROLE_METER_NAMES[roleCode] ?? DEFAULT_METER_NAMES;
}

/**
 * The meters this role owns, longest-neglected first. When the role maps to
 * nothing that exists on this node, the lowest meters stand in — a blank block
 * would read as "you contribute to nothing".
 */
export function selectRoleMeters(
  meters: ReadinessMeter[] | undefined,
  roleCode: string | undefined,
  limit = 3,
): ReadinessMeter[] {
  if (!meters || meters.length === 0) return [];

  const names = getRelevantMeterNames(roleCode).map((n) => n.toLowerCase());
  const matched = meters.filter((meter) =>
    names.some((name) => meter.name.toLowerCase().includes(name)),
  );

  const chosen = matched.length > 0 ? matched : [...meters];
  return chosen
    .sort((a, b) => a.current_value - b.current_value)
    .slice(0, limit);
}

/**
 * SPEC §6.4 — the one place that knows how a meter is deep-linked. `/readiness`
 * opens the matching meter's detail when `?meter=CODE` is present and falls
 * back to the grid when the code is unknown, so a chip whose code could not be
 * resolved still lands somewhere useful rather than on a 404.
 */
export function readinessHref(code: string | null | undefined): string {
  return code ? `/readiness?meter=${encodeURIComponent(code)}` : '/readiness';
}
