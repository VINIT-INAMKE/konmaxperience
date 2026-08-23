'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApprovalEntityChip } from './ApprovalEntityChip';
import { InlineDecision } from './InlineDecision';
import { OverrideDialog } from './OverrideDialog';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode, ROLE_DISPLAY_NAMES } from '@/lib/types/roles';
import type { Approval } from '@/lib/types/approvals';
import {
  APPROVAL_ENTITY_LABELS,
  approvalPolicyLabel,
} from '@/lib/types/approvals';
import { STATUS_BADGE } from '@/lib/status-styles';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** `required_role_code` is a plain string column — unknown codes print as-is. */
function roleLabel(code: string): string {
  return ROLE_DISPLAY_NAMES[code as RoleCode] ?? code;
}

interface ApprovalItemProps {
  approval: Approval;
  onAction: () => void;
}

export function ApprovalItem({ approval, onAction }: ApprovalItemProps) {
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  // Read once per mount, not per render: an approvals list re-renders on every
  // keystroke in its filter box and the age badge must not flicker with it.
  const [readAt] = useState(() => Date.now());
  const waitingMs = readAt - new Date(approval.created_at).getTime();
  const isPendingLong = waitingMs > ONE_DAY_MS;
  const pendingDays = Math.floor(waitingMs / ONE_DAY_MS);

  const subjectTitle =
    approval.subject?.title ?? `${approval.entity_type} ${approval.entity_id.slice(0, 8)}`;

  return (
    <Card className="border-line bg-surface">
      <CardContent className="space-y-3 p-4">
        {/* Row 1 — what is being approved */}
        <div className="flex flex-wrap items-center gap-2">
          {approval.subject?.url ? (
            <Link
              href={approval.subject.url}
              className="group/subject flex items-center gap-2"
            >
              <ApprovalEntityChip entityType={approval.entity_type} />
              <span className="text-sm font-semibold text-ink underline-offset-4 group-hover/subject:underline">
                {subjectTitle}
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <ApprovalEntityChip entityType={approval.entity_type} />
              <span className="text-sm font-semibold text-ink">
                {subjectTitle}
              </span>
            </div>
          )}
          {approval.subject?.status && (
            <Badge variant="outline" className={STATUS_BADGE.neutral}>
              {approval.subject.status}
            </Badge>
          )}
          {/* Age: a badge once it crosses a day, plain text before that */}
          <div className="ml-auto flex items-center gap-3">
            {isPendingLong ? (
              <Badge
                variant="outline"
                className={STATUS_BADGE.warning}
                title={`Pending for ${pendingDays} ${pendingDays === 1 ? 'day' : 'days'}`}
              >
                {pendingDays}d waiting
              </Badge>
            ) : (
              <span className="shrink-0 text-xs text-ink-muted">
                Waiting {formatDistanceToNow(parseISO(approval.created_at))}
              </span>
            )}
          </div>
        </div>

        {/* Row 2 — who has to sign, under which policy, whose work it is */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5 text-ink-subtle">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span className="font-medium">
              {roleLabel(approval.required_role_code)}
            </span>
          </span>
          <span>{approvalPolicyLabel(approval.policy)}</span>
          {approval.subject?.owner && (
            <span>Submitted by {approval.subject.owner.name}</span>
          )}
        </div>

        {/* Row 3 — decide here; the detail page stays one click away */}
        <div className="pt-1">
          <InlineDecision
            approvalId={approval.id}
            subjectLabel={APPROVAL_ENTITY_LABELS[
              approval.entity_type
            ].toLowerCase()}
            onDecided={onAction}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {approval.subject?.url && (
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link href={approval.subject.url} />}
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Open
            </Button>
          )}
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="border-warning/40 text-warning"
              onClick={() => setOverrideDialogOpen(true)}
            >
              Override
            </Button>
          )}
        </div>

        {/* Override attribution — present once an admin has bypassed the gate */}
        {approval.override_reason && (
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="size-3 shrink-0 text-warning" />
            <span className="text-sm italic text-ink-muted">
              Overridden by {approval.overrider?.name ?? 'Admin'} &mdash;{' '}
              {approval.override_reason}
            </span>
            {approval.override_at && (
              <span className="ml-auto shrink-0 text-xs text-ink-muted">
                {formatDistanceToNow(parseISO(approval.override_at), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        )}

        {/* Delegation attribution */}
        {approval.delegated_from_user && (
          <p className="text-sm text-ink-muted">
            Decided by {approval.approver?.name ?? 'Unknown'} on behalf of{' '}
            {approval.delegated_from_user.name}
          </p>
        )}
      </CardContent>

      {isAdmin && (
        <OverrideDialog
          open={overrideDialogOpen}
          onOpenChange={setOverrideDialogOpen}
          approvalId={approval.id}
          onOverridden={onAction}
        />
      )}
    </Card>
  );
}
