'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Task } from '@/lib/types/tasks';

export default function AdminBlockersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  const {
    data: blockedTasks = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['tasks', 'blocked'],
    queryFn: () => apiClient.get<Task[]>('/tasks/blocked'),
    enabled: isAdmin,
  });

  const unblockMutation = useMutation({
    mutationFn: (taskId: string) => apiClient.post(`/tasks/${taskId}/unblock`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', 'blocked'] });
    },
  });

  // Non-admin users get an access-denied panel. Checked after the hooks above so that
  // every render calls the same hooks in the same order; the query is gated by `enabled`.
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-2 text-center">
        <AlertCircle className="size-6 text-destructive" />
        <p className="text-sm text-muted-foreground">
          You don&apos;t have access to this page.
        </p>
        <Link
          href="/dashboard"
          className="text-sm text-primary hover:underline"
        >
          Return to dashboard
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-2 text-center">
        <AlertCircle className="size-6 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Could not load blocked tasks. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Blocked tasks</h1>
          <Badge variant="secondary">{blockedTasks.length}</Badge>
        </div>

        {blockedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <CheckCircle className="size-12 text-green-400" />
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">No blocked tasks</h2>
              <p className="text-sm text-muted-foreground">
                All tasks are running smoothly.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Blocked reason</TableHead>
                <TableHead>Blocked since</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedTasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {task.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {task.owner?.name || 'Unassigned'}
                  </TableCell>
                  <TableCell className="text-sm max-w-[300px]">
                    <span className="truncate block" title={task.blocked_reason || ''}>
                      {task.blocked_reason || 'No reason given'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(parseISO(task.updated_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unblockMutation.mutate(task.id)}
                      disabled={unblockMutation.isPending}
                    >
                      Resolve
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </div>
  );
}
