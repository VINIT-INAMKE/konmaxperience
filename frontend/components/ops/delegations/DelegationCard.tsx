'use client';

import { Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AvatarCircles } from '@/components/ui/avatar-circles';
import { apiClient } from '@/lib/api-client';
import type { ApprovalDelegation } from '@/lib/types/delegations';

interface DelegationCardProps {
  delegation: ApprovalDelegation;
  onDeactivated: () => void;
}

export function DelegationCard({ delegation, onDeactivated }: DelegationCardProps) {
  const isExpired = !delegation.active || new Date(delegation.end_date) < new Date();

  const avatarUrls = [
    {
      imageUrl: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(delegation.from_user?.name || '')}`,
      profileUrl: '#',
    },
    {
      imageUrl: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(delegation.to_user?.name || '')}`,
      profileUrl: '#',
    },
  ];

  const handleDeactivate = async () => {
    try {
      await apiClient.patch(`/delegations/${delegation.id}/deactivate`);
      toast.success('Delegation deactivated.');
      onDeactivated();
    } catch {
      toast.error('Failed to deactivate delegation.');
    }
  };

  return (
    <Card className={isExpired ? 'opacity-60' : ''}>
      <CardContent className="p-4 space-y-2">
        {/* Row 1: Avatars, names, status badge, deactivate button */}
        <div className="flex items-center gap-3">
          <AvatarCircles
            avatarUrls={avatarUrls}
            className="[&_img]:size-7 [&_img]:h-7 [&_img]:w-7"
          />
          <span className="text-[16px] font-semibold flex-1">
            {delegation.from_user?.name ?? 'Unknown'} &rarr; {delegation.to_user?.name ?? 'Unknown'}
          </span>
          {isExpired ? (
            <Badge
              variant="secondary"
              className="bg-muted text-muted-foreground shrink-0"
            >
              Expired
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-blue-500/10 text-blue-400 border-blue-500/30 shrink-0"
            >
              Active
            </Badge>
          )}
          {!isExpired && (
            <Button
              variant="outline"
              size="sm"
              className="text-sm border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0"
              onClick={() => void handleDeactivate()}
            >
              Deactivate
            </Button>
          )}
        </div>

        {/* Row 2: Date range + creator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="size-[14px] text-muted-foreground shrink-0" />
          <span className="font-mono text-sm font-semibold text-foreground">
            {format(parseISO(delegation.start_date), 'MMM d, yyyy')}
          </span>
          <span className="text-muted-foreground">to</span>
          <span className="font-mono text-sm font-semibold text-foreground">
            {format(parseISO(delegation.end_date), 'MMM d, yyyy')}
          </span>
          {delegation.creator && (
            <span className="ml-auto text-[14px] text-muted-foreground">
              Created by {delegation.creator.name}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
