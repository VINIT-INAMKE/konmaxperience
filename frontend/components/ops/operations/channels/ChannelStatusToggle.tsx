'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import type { Channel, ChannelStatus } from '@/lib/types/channel';
import { CHANNEL_STATUS_LABELS } from '@/lib/types/channel';

interface ChannelStatusToggleProps {
  channel: Channel;
  isAdmin: boolean;
  onToggle: (id: string, newStatus: ChannelStatus) => void;
}

export function ChannelStatusToggle({ channel, isAdmin, onToggle }: ChannelStatusToggleProps) {
  const isActive = channel.status === 'active';

  const handleChange = (checked: boolean) => {
    const newStatus: ChannelStatus = checked ? 'active' : 'inactive';
    onToggle(channel.id, newStatus);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="h-11 flex items-center">
            <Switch
              checked={isActive}
              disabled={!isAdmin}
              onCheckedChange={handleChange}
              aria-label={`Toggle ${channel.name} status`}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {CHANNEL_STATUS_LABELS[channel.status]}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
