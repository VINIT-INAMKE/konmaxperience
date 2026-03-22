'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BorderBeam } from '@/components/ui/border-beam';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { apiClient } from '@/lib/api-client';

interface OverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evidenceId: string;
  onOverridden: () => void;
}

export function OverrideDialog({
  open,
  onOpenChange,
  evidenceId,
  onOverridden,
}: OverrideDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const validationId = 'override-reason-validation';
  const isReasonValid = reason.trim().length >= 10;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setReason('');
      setShowValidation(false);
      setIsFocused(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    if (!isReasonValid) {
      setShowValidation(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post(`/approvals/${evidenceId}/override`, {
        reason: reason.trim(),
      });
      toast.success('Approval overridden. Validation cascade triggered.');
      onOverridden();
      onOpenChange(false);
    } catch {
      toast.error('Override failed. Try again or check permissions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Override Approval
          </DialogTitle>
          <DialogDescription>
            Bypassing the approval workflow. This action is recorded in the
            audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="override-reason">Reason</Label>
          <div className="relative overflow-hidden rounded-md">
            <Textarea
              id="override-reason"
              placeholder="State the reason for overriding this approval..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              className="min-h-[80px]"
              aria-required="true"
              aria-describedby={showValidation && !isReasonValid ? validationId : undefined}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            {isFocused && <BorderBeam />}
          </div>
          {showValidation && !isReasonValid && (
            <p
              id={validationId}
              className="text-sm text-destructive"
              role="alert"
            >
              Reason is required (minimum 10 characters).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Keep Waiting
          </Button>
          <ShimmerButton
              shimmerColor="#4ade80"
              className="h-9 px-4 text-sm"
              onClick={() => void handleSubmit()}
              disabled={!isReasonValid || isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
                  Overriding...
                </span>
              ) : (
                'Override and Approve'
              )}
            </ShimmerButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
