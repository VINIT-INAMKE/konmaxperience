'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { BlurFade } from '@/components/ui/blur-fade';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Decision } from '@/lib/types/decisions';

interface DecisionDetailProps {
  decision: Decision;
  onStatusChange: () => void;
}

export function DecisionDetail({ decision, onStatusChange }: DecisionDetailProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await apiClient.patch(`/decisions/${decision.id}`, { status: 'approved' });
      toast.success('Decision approved and locked.');
      void queryClient.invalidateQueries({ queryKey: ['decisions'] });
      onStatusChange();
    } catch {
      toast.error('Failed to approve decision.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await apiClient.patch(`/decisions/${decision.id}`, { status: 'rejected' });
      toast.success('Decision rejected.');
      void queryClient.invalidateQueries({ queryKey: ['decisions'] });
      onStatusChange();
    } catch {
      toast.error('Failed to reject decision.');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleReopen = async () => {
    setIsReopening(true);
    try {
      await apiClient.patch(`/decisions/${decision.id}`, { status: 'proposed' });
      toast.success('Decision reopened.');
      void queryClient.invalidateQueries({ queryKey: ['decisions'] });
      onStatusChange();
      setReopenDialogOpen(false);
    } catch {
      toast.error('Failed to reopen decision.');
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <BlurFade>
      <Card className="p-6 space-y-4">
        {/* Context section */}
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Context
          </p>
          <p className="text-base leading-relaxed">{decision.context}</p>
        </div>

        {/* Links section */}
        {(decision.linked_mission_id || decision.linked_task_id) && (
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Links
            </p>
            <div className="flex flex-wrap gap-2">
              {decision.linked_mission && (
                <Badge variant="outline" className="text-xs gap-1">
                  <ExternalLink className="size-3" />
                  {decision.linked_mission.title}
                </Badge>
              )}
              {decision.linked_task && (
                <Badge variant="outline" className="text-xs gap-1">
                  <ExternalLink className="size-3" />
                  {decision.linked_task.title}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* History section */}
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            History
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-muted-foreground text-xs">
              {formatDistanceToNow(parseISO(decision.updated_at), { addSuffix: true })}
            </span>
            <span className="text-muted-foreground">
              Status changed to {decision.status}
            </span>
          </div>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex items-center gap-2 pt-2 border-t">
            {decision.status === 'proposed' && (
              <>
                <Button
                  size="sm"
                  onClick={() => void handleApprove()}
                  disabled={isApproving}
                >
                  {isApproving ? 'Approving...' : 'Approve Decision'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => void handleReject()}
                  disabled={isRejecting}
                >
                  {isRejecting ? 'Rejecting...' : 'Reject Decision'}
                </Button>
              </>
            )}
            {decision.status === 'approved' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setReopenDialogOpen(true)}
              >
                Reopen Decision
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Reopen confirmation dialog */}
      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen this decision?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Approved decisions are locked for governance integrity. Reopening sets
            status back to Proposed.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setReopenDialogOpen(false)}
            >
              Keep Locked
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleReopen()}
              disabled={isReopening}
            >
              {isReopening ? 'Reopening...' : 'Reopen Decision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BlurFade>
  );
}
