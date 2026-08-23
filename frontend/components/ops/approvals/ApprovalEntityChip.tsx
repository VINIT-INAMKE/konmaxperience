'use client';

import {
  ClipboardList,
  FileCheck2,
  Gavel,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ApprovalEntityType } from '@/lib/types/approvals';
import { APPROVAL_ENTITY_LABELS } from '@/lib/types/approvals';

const ENTITY_ICONS: Record<ApprovalEntityType, LucideIcon> = {
  task: ClipboardList,
  recipe: UtensilsCrossed,
  decision: Gavel,
  evidence: FileCheck2,
};

/**
 * Each entity type gets its own tint so the grouped queue is scannable without
 * reading the label. Colour comes from tokens only (SPEC §7).
 */
const ENTITY_CLASSES: Record<ApprovalEntityType, string> = {
  task: 'border-info-status/35 text-info-status bg-info-status/10',
  recipe: 'border-leaf/35 text-leaf bg-leaf/10',
  decision: 'border-gold/35 text-gold-text bg-gold/10',
  evidence: 'border-brand/35 text-brand bg-brand-soft',
};

interface ApprovalEntityChipProps {
  entityType: ApprovalEntityType;
  className?: string;
}

/**
 * A presentational chip: what kind of thing this approval is about. The caller
 * wraps it (together with the subject title) in the link to `subject.url`.
 */
export function ApprovalEntityChip({
  entityType,
  className,
}: ApprovalEntityChipProps) {
  const Icon = ENTITY_ICONS[entityType];

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 border', ENTITY_CLASSES[entityType], className)}
    >
      <Icon aria-hidden="true" />
      {APPROVAL_ENTITY_LABELS[entityType]}
    </Badge>
  );
}
