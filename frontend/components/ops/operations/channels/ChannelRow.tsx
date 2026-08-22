'use client';

import { Pencil } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChannelStatusToggle } from './ChannelStatusToggle';
import type { Channel, ChannelStatus } from '@/lib/types/channel';
import { channelTypeLabel } from '@/lib/types/channel';

interface ChannelRowProps {
  channel: Channel;
  isAdmin: boolean;
  onToggle: (id: string, newStatus: ChannelStatus) => void;
  onEdit: (channel: Channel) => void;
}

export function ChannelRow({ channel, isAdmin, onToggle, onEdit }: ChannelRowProps) {
  return (
    <TableRow>
      <TableCell>
        <span className="text-sm font-medium">{channel.name}</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {channelTypeLabel(channel.channel_type)}
        </Badge>
      </TableCell>
      <TableCell>
        <ChannelStatusToggle
          channel={channel}
          isAdmin={isAdmin}
          onToggle={onToggle}
        />
      </TableCell>
      <TableCell>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(channel)}
            aria-label={`Edit ${channel.name}`}
          >
            <Pencil className="size-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
