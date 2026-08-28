'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { Label } from '@/components/ui/label';
import { NotificationSettingsForm } from '@/components/ops/admin/settings/NotificationSettingsForm';
import type { SystemSetting, UpdateSettingPayload } from '@/lib/types/settings';
import { readSetting } from '@/lib/types/settings';

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const {
    data: setting,
    isLoading,
  } = useQuery({
    queryKey: ['settings', 'leaderboard_enabled'],
    queryFn: () =>
      apiClient.get<SystemSetting<'leaderboard_enabled'>>('/settings/leaderboard_enabled'),
  });

  // `SystemSetting.value` is a Json column — the boolean arrives (and must be
  // sent back) as a real JSON boolean, never as the string 'true'.
  const isEnabled = readSetting('leaderboard_enabled', setting);

  const mutation = useMutation({
    mutationFn: (value: boolean) => {
      const body: UpdateSettingPayload<'leaderboard_enabled'> = { value };
      return apiClient.patch('/settings/leaderboard_enabled', body);
    },
    onSuccess: (_data, value) => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'leaderboard_enabled'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      toast.success(`Leaderboard ${value ? 'enabled' : 'disabled'}.`);
    },
    onError: () => {
      toast.error('Failed to update leaderboard setting.');
    },
  });

  function handleSwitchChange(checked: boolean) {
    if (!checked) {
      // Toggling OFF — show confirmation dialog
      setConfirmDialogOpen(true);
    } else {
      // Toggling ON — no confirmation needed
      mutation.mutate(true);
    }
  }

  function handleConfirmDisable() {
    mutation.mutate(false);
    setConfirmDialogOpen(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System Settings</h1>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-base font-medium">Enable Leaderboard</Label>
              <p className="text-sm text-muted-foreground max-w-md">
                When disabled, leaderboard rankings are hidden from all users. XP and levels
                continue to accumulate silently.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {isLoading ? (
                <div className="h-5 w-9 rounded-full bg-muted animate-pulse" />
              ) : (
                <Switch
                  checked={isEnabled}
                  onCheckedChange={handleSwitchChange}
                  disabled={mutation.isPending}
                  aria-label="Enable leaderboard"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RUN-01 — the `notifications` Json block, as a typed sub-form. */}
      <NotificationSettingsForm />

      {/* Disable confirmation dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Disable leaderboard?</DialogTitle>
            <DialogDescription>
              Disable leaderboard? Users will no longer see rankings. XP and levels continue to
              accumulate silently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={mutation.isPending}
            >
              Keep Leaderboard Active
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDisable}
              disabled={mutation.isPending}
            >
              Disable Leaderboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
