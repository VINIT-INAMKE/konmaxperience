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
import { ApiError, apiClient } from '@/lib/api-client';

interface OverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The **Approval** row id. Before P3 this was the evidence id and the call
   * only worked because evidence approvals shared the id space.
   */
  approvalId: string;
  onOverridden: () => void;
}

export function OverrideDialog({
  open,
  onOpenChange,
  approvalId,
  onOverridden,
}: OverrideDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const validationId = 'override-reason-validation';
  const isReasonValid = reason.trim().length >= 10;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setReason('');
      setShowValidation(false);
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
      await apiClient.post(`/approvals/${approvalId}/override`, {
        reason: reason.trim(),
      });
      toast.success('Approval overridden. Validation cascade triggered.');
      onOverridden();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : 'Override failed. Try again or check permissions.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Override approval
          </DialogTitle>
          <DialogDescription>
            Bypassing the approval workflow. This action is recorded in the
            audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="override-reason">Reason</Label>
          <Textarea
            id="override-reason"
            placeholder="State the reason for overriding this approval..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            className="min-h-[80px]"
            aria-required="true"
            aria-describedby={
              showValidation && !isReasonValid ? validationId : undefined
            }
          />
          {showValidation && !isReasonValid && (
            <p
              id={validationId}
              className="text-sm text-serious"
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
            Keep waiting
          </Button>
          <Button
            size="lg"
            onClick={() => void handleSubmit()}
            disabled={!isReasonValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
                Overriding...
              </>
            ) : (
              'Override and approve'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
