'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { RecipeStatus } from '@/lib/types/recipe';
import { RECIPE_STATUS_LABELS } from '@/lib/types/recipe';

interface RecipeStatusBannerProps {
  status: RecipeStatus;
  isApprover: boolean;
  isSaving: boolean;
  onStatusChange: (newStatus: RecipeStatus) => void;
  onCreateVersion: () => void;
}

export function RecipeStatusBanner({
  status,
  isApprover,
  isSaving,
  onStatusChange,
  onCreateVersion,
}: RecipeStatusBannerProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);

  const bannerClasses: Record<RecipeStatus, string> = {
    draft: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
    pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    approved: 'bg-green-500/10 text-green-600 dark:text-green-400',
    archived: 'bg-[var(--muted)]/50 text-[var(--muted-foreground)]',
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between rounded-lg px-4 h-12',
          bannerClasses[status]
        )}
      >
        <span className="text-sm font-medium">
          {status === 'approved' && 'Approved — locked for editing'}
          {status === 'archived' && (
            <span className="line-through">{RECIPE_STATUS_LABELS[status]}</span>
          )}
          {status === 'draft' && RECIPE_STATUS_LABELS[status]}
          {status === 'pending' && RECIPE_STATUS_LABELS[status]}
        </span>

        <div className="flex items-center gap-2">
          {status === 'draft' && (
            <Button
              size="sm"
              onClick={() => onStatusChange('pending')}
              disabled={isSaving}
            >
              Submit for Approval
            </Button>
          )}

          {status === 'pending' && isApprover && (
            <>
              <Button
                size="sm"
                onClick={() => onStatusChange('approved')}
                disabled={isSaving}
              >
                Approve Recipe
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setRejectDialogOpen(true)}
                disabled={isSaving}
              >
                Reject Recipe
              </Button>
            </>
          )}

          {status === 'approved' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setVersionDialogOpen(true)}
                disabled={isSaving}
              >
                Create New Version
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setArchiveDialogOpen(true)}
                disabled={isSaving}
              >
                Archive Recipe
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Reject confirmation dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send back to draft?</DialogTitle>
            <DialogDescription>
              This recipe will return to draft status and the author will need to
              re-submit for approval.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onStatusChange('draft');
                setRejectDialogOpen(false);
              }}
            >
              Send Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this recipe?</DialogTitle>
            <DialogDescription>
              Archive this recipe? It will be hidden from menus and marked as
              archived. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveDialogOpen(false)}
            >
              Keep Recipe
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onStatusChange('archived');
                setArchiveDialogOpen(false);
              }}
            >
              Archive Recipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create new version confirmation dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new version?</DialogTitle>
            <DialogDescription>
              Create a new version? The current approved recipe will be archived
              and a draft copy will be created for editing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVersionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onCreateVersion();
                setVersionDialogOpen(false);
              }}
            >
              Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
