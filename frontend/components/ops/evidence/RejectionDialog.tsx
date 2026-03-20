'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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

interface RejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReject: (notes: string) => void;
  isSubmitting: boolean;
}

export function RejectionDialog({
  open,
  onOpenChange,
  onReject,
  isSubmitting,
}: RejectionDialogProps) {
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (notes.trim()) {
      onReject(notes.trim());
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setNotes('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject evidence</DialogTitle>
          <DialogDescription>
            Tell the task owner what needs to be corrected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rejection-reason">Reason</Label>
          <Textarea
            id="rejection-reason"
            placeholder="e.g. The photo doesn't clearly show the completed setup. Please retake with better lighting."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            rows={4}
          />
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Keep pending
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!notes.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none mr-2" />
                Rejecting...
              </>
            ) : (
              'Reject evidence'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
