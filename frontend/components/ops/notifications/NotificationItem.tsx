'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Notification, NotificationType } from '@/lib/types/notifications';
import { cn } from '@/lib/utils';
import { STATUS_BADGE } from '@/lib/status-styles';
import {
  Clock,
  ShieldAlert,
  ClipboardCheck,
  PackageX,
  ChefHat,
  Bell,
  Truck,
  Megaphone,
  Check,
  CircleX,
  Sunrise,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';

/**
 * One place where a notification type becomes a colour and a glyph. `badge` is a
 * `STATUS_BADGE` key's class string — types carry *meaning*, so none of them
 * declares its own colour (SPEC §7). `admin_notice` has no status meaning, so it
 * falls to `neutral` rather than inventing a pair.
 */
export const NOTIFICATION_STYLE: Record<
  NotificationType,
  { badge: string; icon: LucideIcon }
> = {
  task_due: { badge: STATUS_BADGE.warning, icon: Clock },
  task_blocked: { badge: STATUS_BADGE.serious, icon: ShieldAlert },
  approval_pending: { badge: STATUS_BADGE.warning, icon: ClipboardCheck },
  low_stock: { badge: STATUS_BADGE.warning, icon: PackageX },
  new_order: { badge: STATUS_BADGE.info, icon: ChefHat },
  order_ready: { badge: STATUS_BADGE.good, icon: Bell },
  delivery_update: { badge: STATUS_BADGE.info, icon: Truck },
  admin_notice: { badge: STATUS_BADGE.neutral, icon: Megaphone },
  // A shipment that could not be booked is a broken promise to a customer, so
  // it reads `serious` rather than sitting in `delivery_update`'s `info` blue.
  shipment_failed: { badge: STATUS_BADGE.serious, icon: CircleX },
  // The brief reports, it does not ask for anything — `info`, like `new_order`.
  morning_brief: { badge: STATUS_BADGE.info, icon: Sunrise },
  // An outstanding close is a task waiting on a person, like `approval_pending`.
  daily_close_due: { badge: STATUS_BADGE.warning, icon: CalendarClock },
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

  const style = NOTIFICATION_STYLE[item.type];
  const TypeIcon = style?.icon ?? Bell;
  const badgeClassName = style?.badge ?? STATUS_BADGE.neutral;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted transition-colors motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-inset',
        !item.is_read && 'bg-primary/5',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border',
          badgeClassName,
        )}
      >
        <TypeIcon className="size-4" aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{item.title}</p>
        <p className="text-sm text-muted-foreground line-clamp-2">{item.body}</p>
        <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(item.created_at)}</p>
      </div>
      {!item.is_read && (
        <button
          aria-label="Mark as read"
          className="mt-1 size-4 shrink-0 rounded-full flex items-center justify-center hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          onClick={handleMarkRead}
        >
          <Check className="size-3" />
        </button>
      )}
    </div>
  );
}
