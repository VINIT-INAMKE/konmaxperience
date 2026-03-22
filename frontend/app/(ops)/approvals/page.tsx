'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { ApprovalQueue } from '@/components/ops/approvals/ApprovalQueue';
import { apiClient } from '@/lib/api-client';
import type { Evidence } from '@/lib/types/evidence';

export default function ApprovalsPage() {
  const { data: pendingEvidence } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () =>
      apiClient.get<Evidence[]>('/evidence?status=pending'),
  });

  const pendingCount = pendingEvidence?.length ?? 0;

  return (
      <div className="space-y-6">
        {/* Page header */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Approvals</h1>
            {pendingCount > 0 && (
              <Badge
                variant="secondary"
                className="text-amber-400 bg-amber-950 border-amber-500/20"
              >
                {pendingCount} pending
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Evidence waiting for your review.
          </p>
        </div>

        {/* Approval queue */}
        <ApprovalQueue />
      </div>
  );
}
