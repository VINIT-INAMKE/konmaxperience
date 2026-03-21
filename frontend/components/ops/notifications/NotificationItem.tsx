'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Notification, NotificationType } from '@/lib/types/notifications';
import { cn } from '@/lib/utils';
import {
  Clock,
  ShieldAlert,
  ClipboardCheck,
  PackageX,
  ChefHat,
  Bell,
  Truck,
  Check,
} from 'lucide-react';

const TYPE_ICONS: Record<NotificationType, { icon: typeof Clock; className: string }> = {
  task_due: { icon: Clock, className: 'text-amber-400' },
  task_blocked: { icon: ShieldAlert, className: 'text-amber-400' },
  approval_pending: { icon: ClipboardCheck, className: 'text-amber-400' },
  low_stock: { icon: PackageX, className: 'text-orange-400' },
  new_order: { icon: ChefHat, className: 'text-blue-400' },
  order_ready: { icon: Bell, className: 'text-green-400' },
  delivery_update: { icon: Truck, className: 'text-blue-400' },
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface NotificationItemProps {
  item: Notification;
  onNavigate?: () => void; // called to close popover after navigation
}

export function NotificationItem({ item, onNavigate }: NotificationItemProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const markReadMutation = useMutation({
    mutationFn: () => apiClient.patch(`/notifications/${item.id}/read`),
    onMutate: () => {
      // Optimistic: decrement unread count
      queryClient.setQueryData<{ count: number }>(
        ['notifications', 'unread-count'],
        (old) => ({ count: Math.max(0, (old?.count ?? 1) - 1) }),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleClick = () => {
    if (!item.is_read) {
      markReadMutation.mutate();
    }
    if (item.link_url) {
      router.push(item.link_url);
      onNavigate?.();
    }
  };

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.is_read) {
      markReadMutation.mutate();
    }
  };

  const TypeIcon = TYPE_ICONS[item.type]?.icon ?? Bell;
  const iconClassName = TYPE_ICONS[item.type]?.className ?? 'text-muted-foreground';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted transition-colors',
        !item.is_read && 'bg-primary/5',
      )}
    >
      <div className="mt-0.5 shrink-0">
        <TypeIcon className={cn('size-4', iconClassName)} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{item.title}</p>
        <p className="text-sm text-muted-foreground line-clamp-2">{item.body}</p>
        <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(item.created_at)}</p>
      </div>
      {!item.is_read && (
        <button
          aria-label="Mark as read"
          className="mt-1 size-4 shrink-0 rounded-full flex items-center justify-center hover:bg-muted"
          onClick={handleMarkRead}
        >
          <Check className="size-3" />
        </button>
      )}
    </div>
  );
}
