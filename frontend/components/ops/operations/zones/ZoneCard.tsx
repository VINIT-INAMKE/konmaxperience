'use client';

import {
  ChefHat,
  UtensilsCrossed,
  Leaf,
  Monitor,
  Archive,
  Coffee,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
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

const ZONE_TYPE_ICONS: Record<ZoneType, React.ReactNode> = {
  kitchen: <ChefHat className="size-4 text-ink-muted" />,
  dining: <UtensilsCrossed className="size-4 text-ink-muted" />,
  outdoor: <Leaf className="size-4 text-ink-muted" />,
  workspace: <Monitor className="size-4 text-ink-muted" />,
  storage: <Archive className="size-4 text-ink-muted" />,
  leisure: <Coffee className="size-4 text-ink-muted" />,
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
  const canEdit = isAdmin || currentUserId === zone.owner_user_id;
  const ownerName = zone.owner?.name ?? null;

  return (
    <div className="relative rounded-lg">
      <Card
        className={`p-4 gap-2 space-y-2 cursor-pointer transition-colors motion-reduce:transition-none hover:bg-muted/20 ${
          isNew ? 'ring-2 ring-brand/40' : ''
        }`}
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
              <span className="text-sm text-ink-muted">{ownerName}</span>
            </>
          ) : (
            <span className="text-sm text-ink-muted">No owner</span>
          )}
          <span className="text-xs text-ink-muted ml-auto">
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
            <p className="text-xs text-ink-muted line-clamp-1 flex-1">
              {zone.notes}
            </p>
          )}
          {isAdmin && (
            <button
              className="ml-auto p-1 rounded text-ink-muted transition-colors motion-reduce:transition-none hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
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
      </Card>
    </div>
  );
}
