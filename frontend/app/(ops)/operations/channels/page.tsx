'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { ChannelRow } from '@/components/ops/operations/channels/ChannelRow';
import { ChannelForm } from '@/components/ops/operations/channels/ChannelForm';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { Channel, ChannelStatus } from '@/lib/types/channel';

export default function ChannelsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const isAdmin = hasPermission('MANAGE_OPS');

  const [formOpen, setFormOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  const {
    data: channels,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['channels'],
    queryFn: () => apiClient.get<Channel[]>('/channels'),
  });

  const handleToggle = async (id: string, newStatus: ChannelStatus) => {
    try {
      await apiClient.patch(`/channels/${id}`, { status: newStatus });
      await queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Channel status updated.');
    } catch {
      toast.error('Something went wrong. Refresh the page or try again in a moment.');
    }
  };

  const handleEdit = (channel: Channel) => {
    setEditingChannel(channel);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingChannel(null);
    }
  };

  return (
    <BlurFade>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-[28px] font-semibold leading-tight">Channels</h1>
          {isAdmin && (
            <ShimmerButton
              shimmerColor="#4ade80"
              className="h-9 text-sm px-4"
              onClick={() => {
                setEditingChannel(null);
                setFormOpen(true);
              }}
            >
              Add Channel
            </ShimmerButton>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 7 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-8 w-10 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">
            Something went wrong. Refresh the page or try again in a moment.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels?.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  isAdmin={isAdmin}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                />
              ))}
            </TableBody>
          </Table>
        )}

        {/* Channel Form Sheet */}
        <ChannelForm
          open={formOpen}
          onOpenChange={handleFormOpenChange}
          channel={editingChannel ?? undefined}
          onSuccess={() => {
            // success is handled via toast and query invalidation in ChannelForm
          }}
        />
      </div>
    </BlurFade>
  );
}
