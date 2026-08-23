'use client';

import { Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BrandStatusBadge } from './BrandStatusBadge';
import type { Brand } from '@/lib/types/brand';
import { BRAND_TYPE_LABELS } from '@/lib/types/brand';

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
  const canEdit = isAdmin || currentUserId === brand.owner_user_id;
  const ownerName = brand.owner?.name ?? null;

  return (
    <div className="relative rounded-lg">
      <Card
        className={`p-4 gap-2 space-y-2 cursor-pointer transition-colors motion-reduce:transition-none hover:bg-muted/20 ${
          isNew ? 'ring-2 ring-brand/40' : ''
        }`}
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
              <span className="text-sm text-ink-muted">{ownerName}</span>
            </>
          ) : (
            <span className="text-sm text-ink-muted">No owner</span>
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
              className="ml-auto p-1 rounded text-ink-muted transition-colors motion-reduce:transition-none hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
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
      </Card>
    </div>
  );
}
