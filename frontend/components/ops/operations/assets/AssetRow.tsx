'use client';

import { ExternalLink, Pencil, Trash2, BookOpen, ClipboardList, List, DollarSign, GraduationCap } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShineBorder } from '@/components/ui/shine-border';
import { AssetStatusBadge } from './AssetStatusBadge';
import type { Asset, AssetType } from '@/lib/types/asset';
import { ASSET_TYPE_LABELS } from '@/lib/types/asset';
import type { LucideIcon } from 'lucide-react';

const ASSET_TYPE_ICONS: Record<AssetType, LucideIcon> = {
  recipe: BookOpen,
  sop: ClipboardList,
  menu: List,
  cost_sheet: DollarSign,
  training_doc: GraduationCap,
};

interface AssetRowProps {
  asset: Asset;
  isAdmin: boolean;
  currentUserId: string;
  isNew?: boolean;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
}

export function AssetRow({ asset, isAdmin, currentUserId, isNew, onEdit, onDelete }: AssetRowProps) {
  const Icon = ASSET_TYPE_ICONS[asset.asset_type];
  const isCreator = asset.created_by === currentUserId;
  const canEdit = isAdmin || isCreator;

  return (
    <TableRow className="relative">
      {isNew && (
        <ShineBorder
          shineColor={['#4ade80', '#22d3ee', '#a78bfa']}
          duration={3}
          borderWidth={2}
        />
      )}

      {/* Name */}
      <TableCell>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">{asset.name}</span>
        </div>
      </TableCell>

      {/* Type */}
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {ASSET_TYPE_LABELS[asset.asset_type]}
        </Badge>
      </TableCell>

      {/* Brand */}
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {asset.linked_brand?.name ?? '\u2014'}
        </span>
      </TableCell>

      {/* Status */}
      <TableCell>
        <div className="flex items-center gap-2">
          <AssetStatusBadge status={asset.status} />
          {asset.status === 'approved' && (
            <span className="text-xs text-green-400">Ready for display</span>
          )}
        </div>
      </TableCell>

      {/* Uploaded by */}
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {asset.creator?.name ?? '\u2014'}
        </span>
      </TableCell>

      {/* Date */}
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {new Date(asset.created_at).toLocaleDateString()}
        </span>
      </TableCell>

      {/* Actions */}
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => window.open(asset.url, '_blank', 'noopener,noreferrer')}
            aria-label={`View ${asset.name}`}
          >
            <ExternalLink className="size-4" />
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(asset)}
              aria-label={`Edit ${asset.name}`}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(asset)}
              aria-label={`Delete ${asset.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
