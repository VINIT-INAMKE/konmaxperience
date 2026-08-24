/**
 * Semantic status classes. Colour lives in tokens.css; this file maps *meaning* to
 * token classes. `serious` is a tint + coloured text, `critical` is a solid fill +
 * inverse text — the two are differentiated by weight, not hue.
 */

export const STATUS_BADGE = {
  good:     'text-[var(--status-good)] bg-[var(--status-good)]/12 border-[var(--status-good)]/25',
  warning:  'text-[var(--status-warning)] bg-[var(--status-warning)]/12 border-[var(--status-warning)]/25',
  serious:  'text-[var(--status-serious)] bg-[var(--status-serious)]/12 border-[var(--status-serious)]/25',
  critical: 'text-[var(--status-critical-ink)] bg-[var(--status-critical)] border-transparent',
  info:     'text-[var(--status-info)] bg-[var(--status-info)]/12 border-[var(--status-info)]/25',
  neutral:  'text-ink-muted bg-surface-raised border-transparent',
  /** Retired/abandoned states — present but no longer live. */
  muted:    'text-ink-muted bg-surface-raised border-transparent line-through',
  // The colour-named aliases (`amber`, `blue`, `green`, `red`) that bridged the
  // Wave 1 sweeps were deleted in Task 19 — every call site now names a meaning.
} as const;

/** Prisma `TaskStatus` — `todo` is the neutral default. */
export function getTaskStatusBadge(status: string): string {
  switch (status) {
    case 'doing': return STATUS_BADGE.info;
    case 'done': return STATUS_BADGE.good;
    case 'blocked': return STATUS_BADGE.critical;
    case 'cancelled': return STATUS_BADGE.muted;
    default: return STATUS_BADGE.neutral;
  }
}

export function getTaskTypeBadge(type: string): string {
  switch (type) {
    case 'adhoc': return STATUS_BADGE.warning;
    case 'improvement': return STATUS_BADGE.info;
    default: return '';
  }
}

export function getPriorityBadge(priority: string): string {
  switch (priority) {
    case 'critical': return STATUS_BADGE.critical;
    case 'high': return STATUS_BADGE.serious;
    case 'medium': return STATUS_BADGE.warning;
    default: return '';
  }
}

export function getEvidenceStatusBadge(status: string): string {
  switch (status) {
    case 'pending': return STATUS_BADGE.warning;
    case 'approved': return STATUS_BADGE.good;
    case 'rejected': return STATUS_BADGE.serious;
    default: return STATUS_BADGE.neutral;
  }
}

/** Readiness 0–100 → the four-band ramp (SPEC §7 status colours). */
export function getReadinessBandBadge(value: number): string {
  if (value >= 75) return STATUS_BADGE.good;
  if (value >= 50) return STATUS_BADGE.warning;
  if (value >= 25) return STATUS_BADGE.serious;
  return STATUS_BADGE.critical;
}

/** Bare token for chart series and SVG fills, which cannot take a class. */
export function readinessBandToken(value: number): string {
  if (value >= 75) return 'var(--status-good)';
  if (value >= 50) return 'var(--status-warning)';
  if (value >= 25) return 'var(--status-serious)';
  return 'var(--status-critical)';
}
