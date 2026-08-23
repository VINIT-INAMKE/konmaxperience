'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import type { Channel, ChannelType, ChannelStatus } from '@/lib/types/channel';
import {
  CHANNEL_TYPES,
  CHANNEL_STATUSES,
  CHANNEL_TYPE_LABELS,
  CHANNEL_STATUS_LABELS,
} from '@/lib/types/channel';
import { useQueryClient } from '@tanstack/react-query';

interface ChannelFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel?: Channel;
  onSuccess: () => void;
}

export function ChannelForm({ open, onOpenChange, channel, onSuccess }: ChannelFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!channel;

  const [name, setName] = useState('');
  const [channelType, setChannelType] = useState<ChannelType | ''>('');
  const [status, setStatus] = useState<ChannelStatus>('planned');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && channel) {
      setName(channel.name);
      setChannelType(channel.channel_type);
      setStatus(channel.status);
    } else if (!open) {
      setName('');
      setChannelType('');
      setStatus('planned');
    }
  }, [open, channel]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !channelType) return;

    setIsSubmitting(true);
    try {
      if (isEdit && channel) {
        await apiClient.patch(`/channels/${channel.id}`, {
          name: name.trim(),
          channel_type: channelType,
          status,
        });
        toast.success('Channel updated.');
      } else {
        await apiClient.post('/channels', {
          name: name.trim(),
          channel_type: channelType,
          status: 'planned',
        });
        toast.success('Channel created.');
      }
      await queryClient.invalidateQueries({ queryKey: ['channels'] });
      handleClose();
      onSuccess();
    } catch {
      toast.error('Something went wrong. Refresh the page or try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Channel' : 'Add Channel'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-4 px-4 pb-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="channel-name">Name</Label>
            <Input
              id="channel-name"
              placeholder="e.g. Dine-in Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Channel Type */}
          <div className="space-y-2">
            <Label>Channel Type</Label>
            <Select
              value={channelType}
              onValueChange={(v) => setChannelType(v as ChannelType)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {CHANNEL_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status — edit only */}
          {isEdit && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ChannelStatus)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CHANNEL_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim() || !channelType}
              className="h-9 text-sm px-4"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </span>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Add Channel'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
