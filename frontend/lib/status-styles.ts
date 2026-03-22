/**
 * Shared status badge color maps for the ops dark theme.
 *
 * Pattern: `text-{color}-400 bg-{color}-950 border-{color}-500/20`
 * These are designed for dark backgrounds and used across tasks, evidence, sidebar, etc.
 */

// --- Semantic status colors (dark theme badges) ---

export const STATUS_BADGE = {
  amber: 'text-amber-400 bg-amber-950 border-amber-500/20',
  blue: 'text-blue-400 bg-blue-950 border-blue-500/20',
  green: 'text-green-400 bg-green-950 border-green-500/20',
  red: 'text-red-400 bg-red-950 border-red-500/20',
} as const;

// --- Domain-specific mappings ---

export function getTaskStatusBadge(status: string): string {
  switch (status) {
    case 'doing':
      return STATUS_BADGE.blue;
    case 'done':
      return STATUS_BADGE.green;
    case 'blocked':
      return STATUS_BADGE.red;
    default:
      return '';
  }
}

export function getTaskTypeBadge(type: string): string {
  switch (type) {
    case 'adhoc':
      return STATUS_BADGE.amber;
    case 'improvement':
      return STATUS_BADGE.blue;
    default:
      return '';
  }
}

export function getPriorityBadge(priority: string): string {
  switch (priority) {
    case 'critical':
      return STATUS_BADGE.red;
    case 'high':
      return STATUS_BADGE.amber;
    default:
      return '';
  }
}

export function getEvidenceStatusBadge(status: string): string {
  switch (status) {
    case 'pending':
      return STATUS_BADGE.amber;
    case 'approved':
      return STATUS_BADGE.green;
    case 'rejected':
      return STATUS_BADGE.red;
    default:
      return '';
  }
}
