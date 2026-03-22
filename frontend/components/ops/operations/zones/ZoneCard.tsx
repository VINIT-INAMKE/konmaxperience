'use client';

import { useState, useEffect } from 'react';
import {
  ChefHat,
  UtensilsCrossed,
  Leaf,
  Monitor,
  Archive,
  Coffee,
  Trash2,
} from 'lucide-react';
import { MagicCard } from '@/components/ui/magic-card';
import { ShineBorder } from '@/components/ui/shine-border';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ZoneStatusBadge } from './ZoneStatusBadge';
import type { Zone, ZoneType } from '@/lib/types/zone';
import { ZONE_TYPE_LABELS } from '@/lib/types/zone';
import { GRADIENT_OVERLAY } from '@/lib/brand-colors';

const ZONE_TYPE_ICONS: Record<ZoneType, React.ReactNode> = {
  kitchen: <ChefHat className="size-4 text-muted-foreground" />,
  dining: <UtensilsCrossed className="size-4 text-muted-foreground" />,
  outdoor: <Leaf className="size-4 text-muted-foreground" />,
  workspace: <Monitor className="size-4 text-muted-foreground" />,
  storage: <Archive className="size-4 text-muted-foreground" />,
  leisure: <Coffee className="size-4 text-muted-foreground" />,
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface ZoneCardProps {
  zone: Zone;
  isAdmin: boolean;
  currentUserId: string;
  isNew?: boolean;
  onEdit: (zone: Zone) => void;
  onDelete: (zone: Zone) => void;
}

export function ZoneCard({
  zone,
  isAdmin,
  currentUserId,
  isNew = false,
  onEdit,
  onDelete,
}: ZoneCardProps) {
  const [showShine, setShowShine] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      setShowShine(true);
      const timer = setTimeout(() => setShowShine(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const canEdit = isAdmin || currentUserId === zone.owner_user_id;
  const ownerName = zone.owner?.name ?? null;

  return (
    <div className="relative rounded-lg">
      {showShine && (
        <ShineBorder
          shineColor={['#4ade80', '#22d3ee', '#a78bfa']}
          duration={3}
          borderWidth={2}
        />
      )}
      <MagicCard
        gradientColor={GRADIENT_OVERLAY}
        className="p-4 space-y-2 cursor-pointer hover:bg-muted/20 transition-colors"
      >
        {/* Row 1: type icon + name + status badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger>
              {ZONE_TYPE_ICONS[zone.zone_type]}
            </TooltipTrigger>
            <TooltipContent>
              {ZONE_TYPE_LABELS[zone.zone_type]}
            </TooltipContent>
          </Tooltip>
          <span className="text-base font-semibold">{zone.name}</span>
          <ZoneStatusBadge status={zone.status} />
        </div>

        {/* Row 2: owner + zone type label */}
        <div className="flex items-center gap-2">
          {ownerName ? (
            <>
              <Avatar className="size-5">
                <AvatarFallback className="text-[10px]">
                  {getInitials(ownerName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">{ownerName}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No owner</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {ZONE_TYPE_LABELS[zone.zone_type]}
          </span>
        </div>

        {/* Row 3: edit/delete + notes */}
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-3"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(zone);
              }}
            >
              Edit
            </Button>
          )}
          {zone.notes && (
            <p className="text-xs text-muted-foreground line-clamp-1 flex-1">
              {zone.notes}
            </p>
          )}
          {isAdmin && (
            <button
              className="ml-auto p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(zone);
              }}
              aria-label="Delete zone"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </MagicCard>
    </div>
  );
}
