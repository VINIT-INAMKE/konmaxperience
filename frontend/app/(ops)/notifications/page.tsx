'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Notification } from '@/lib/types/notifications';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationItem } from '@/components/ops/notifications/NotificationItem';
import { BellOff } from 'lucide-react';

const TAB_FILTERS: Record<string, string> = {
  all: '',
  unread: 'is_read=false',
  tasks: 'type=task_due,task_blocked',
  approvals: 'type=approval_pending',
  ops: 'type=low_stock,new_order,order_ready,delivery_update',
};

const PAGE_SIZE = 20;

function EmptyState({ tab }: { tab: string }) {
  const headings: Record<string, string> = {
    all: 'No notifications yet',
    unread: 'All caught up',
    tasks: 'No task notifications',
    approvals: 'No approval notifications',
    ops: 'No operations notifications',
  };
  const bodies: Record<string, string> = {
    all: 'Alerts for tasks, approvals, stock levels, and orders will appear here.',
    unread: 'You have no unread notifications.',
    tasks: 'Task deadline and blocker alerts will appear here.',
    approvals: 'Approval pending alerts will appear here.',
    ops: 'Stock, order, and delivery alerts will appear here.',
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BellOff className="size-10 text-muted-foreground mb-3" aria-hidden="true" />
      <p className="text-sm font-bold">{headings[tab] ?? headings.all}</p>
      <p className="text-sm text-muted-foreground mt-1">{bodies[tab] ?? bodies.all}</p>
    </div>
  );
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [loadedItems, setLoadedItems] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Build query path from active tab and cursor
  const filterParam = TAB_FILTERS[activeTab] ?? '';
  const queryPath = `/notifications?limit=${PAGE_SIZE}${cursor ? '&cursor=' + cursor : ''}${filterParam ? '&' + filterParam : ''}`;

  const { data, isLoading, isFetching } = useQuery<Notification[]>({
    queryKey: ['notifications', 'page', activeTab, cursor],
    queryFn: () => apiClient.get<Notification[]>(queryPath),
    staleTime: 30_000,
  });

  // Append fetched data to loaded items
  useEffect(() => {
    if (data) {
      if (cursor === null) {
        // First page — replace items
        setLoadedItems(data);
      } else {
        // Subsequent pages — append
        setLoadedItems((prev) => [...prev, ...data]);
      }
      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      }
    }
  }, [data, cursor]);

  // Reset when tab changes
  const handleTabChange = useCallback((value: unknown) => {
    const v = value as string;
    setActiveTab(v);
    setCursor(null);
    setLoadedItems([]);
    setHasMore(true);
  }, []);

  // Mark all read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.post('/notifications/read-all'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setLoadedItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    },
  });

  const handleLoadMore = () => {
    const lastItem = loadedItems[loadedItems.length - 1];
    if (lastItem) {
      setCursor(lastItem.id);
    }
  };

  return (
    <BlurFade>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[20px] font-bold">Notifications</h1>
          <Button
            variant="outline"
            size="sm"
            disabled={markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
          >
            Mark all as read
          </Button>
        </div>

        {/* Tab filters */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="ops">Operations</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-4">
            {/* Loading state */}
            {isLoading && loadedItems.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : loadedItems.length > 0 ? (
              <div className="divide-y">
                {loadedItems.map((n) => (
                  <NotificationItem key={n.id} item={n} />
                ))}
                {hasMore && (
                  <div className="py-4 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isFetching}
                      onClick={handleLoadMore}
                    >
                      {isFetching ? 'Loading...' : 'Load more notifications'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState tab={activeTab} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </BlurFade>
  );
}
