'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type { Notification, NotificationUnreadCount } from '@/lib/types/notifications';
import { Bell, BellOff } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationItem } from './NotificationItem';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Poll unread count every 30 seconds (D-09)
  const { data: unreadData } = useQuery<NotificationUnreadCount>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiClient.get<NotificationUnreadCount>('/notifications/unread-count'),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
  const unreadCount = unreadData?.count ?? 0;

  // Order-ready Sonner toast (NOTF-06 only, per UI-SPEC)
  const prevUnreadRef = useRef<number>(0);
  const [seeded, setSeeded] = useState(false);

  // Seed the previous unread count on first data load to prevent initial toast flood
  useEffect(() => {
    if (!seeded && unreadData !== undefined) {
      prevUnreadRef.current = unreadCount;
      setSeeded(true);
    }
  }, [unreadCount, seeded, unreadData]);

  // When unread count increases after seeding, check if latest is order_ready
  useEffect(() => {
    if (!seeded) return;
    if (unreadCount > prevUnreadRef.current && unreadCount > 0) {
      apiClient
        .get<Notification[]>('/notifications?limit=1')
        .then((items) => {
          if (items[0]?.type === 'order_ready' && !items[0].is_read) {
            const shortId = items[0].reference_id?.slice(-6).toUpperCase() ?? '';
            toast.success(`Order #${shortId} is ready`, { duration: 5000 });
          }
        })
        .catch(() => {}); // silent failure per D-03
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, seeded]);

  // Fetch recent notifications when panel opens
  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', 'recent'],
    queryFn: () => apiClient.get<Notification[]>('/notifications?limit=20'),
    enabled: open,
    staleTime: 0,
  });

  // Mark all read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.post('/notifications/read-all'),
    onMutate: () => {
      queryClient.setQueryData<NotificationUnreadCount>(
        ['notifications', 'unread-count'],
        { count: 0 },
      );
      queryClient.setQueryData<Notification[]>(
        ['notifications', 'recent'],
        (old) => old?.map((n) => ({ ...n, is_read: true })) ?? [],
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const displayCount = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative inline-flex size-8 items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center px-1"
            aria-label={`${unreadCount} unread notifications`}
          >
            {displayCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-80 p-0"
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-bold">Notifications</span>
          <button
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
          >
            Mark all as read
          </button>
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-[480px]">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : notifications && notifications.length > 0 ? (
            <div role="region" aria-label="Recent notifications">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  item={n}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <BellOff className="size-8 text-muted-foreground mb-2" aria-hidden="true" />
              <p className="text-sm font-bold">You&apos;re all caught up</p>
              <p className="text-sm text-muted-foreground">
                No new notifications. Check back when something needs your attention.
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Panel footer */}
        <Separator />
        <div className="px-4 py-2">
          <Link
            href="/notifications"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
