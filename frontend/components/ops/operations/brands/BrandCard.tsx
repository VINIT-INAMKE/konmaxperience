'use client';

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { MagicCard } from '@/components/ui/magic-card';
import { ShineBorder } from '@/components/ui/shine-border';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BrandStatusBadge } from './BrandStatusBadge';
import type { Brand } from '@/lib/types/brand';
import { BRAND_TYPE_LABELS } from '@/lib/types/brand';
import { GRADIENT_OVERLAY } from '@/lib/brand-colors';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface BrandCardProps {
  brand: Brand;
  isAdmin: boolean;
  currentUserId: string;
  isNew?: boolean;
  onEdit: (brand: Brand) => void;
  onDelete: (brand: Brand) => void;
}

export function BrandCard({
  brand,
  isAdmin,
  currentUserId,
  isNew = false,
  onEdit,
  onDelete,
}: BrandCardProps) {
  const [showShine, setShowShine] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      setShowShine(true);
      const timer = setTimeout(() => setShowShine(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const canEdit = isAdmin || currentUserId === brand.owner_user_id;
  const ownerName = brand.owner?.name ?? null;

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
        {/* Row 1: brand name + type badge + status badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-semibold">{brand.name}</span>
          <Badge variant="outline" className="text-xs">
            {BRAND_TYPE_LABELS[brand.brand_type]}
          </Badge>
          <BrandStatusBadge status={brand.status} />
        </div>

        {/* Row 2: owner avatar + owner name */}
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
        </div>

        {/* Row 3: edit/delete */}
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-3"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(brand);
              }}
            >
              Edit
            </Button>
          )}
          {isAdmin && (
            <button
              className="ml-auto p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(brand);
              }}
              aria-label="Delete brand"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </MagicCard>
    </div>
  );
}
