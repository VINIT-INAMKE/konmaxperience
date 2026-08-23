'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO, isPast, formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BlockerDialog } from '@/components/ops/tasks/BlockerDialog';
import { EvidenceSection } from '@/components/ops/evidence/EvidenceSection';
import { apiClient } from '@/lib/api-client';
import {
  STATUS_BADGE,
  getPriorityBadge,
  getTaskStatusBadge,
  getTaskTypeBadge,
} from '@/lib/status-styles';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Task, TaskStatus } from '@/lib/types/tasks';
import {
  TASK_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_DOMAIN_LABELS,
  TASK_TYPE_XP_WEIGHT,
} from '@/lib/types/tasks';
import { ExportButton } from '@/components/ops/exports/ExportButton';

const selectableStatuses: TaskStatus[] = ['todo', 'doing', 'done'];

/** Two-letter monogram for the avatar fallback. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function TaskDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  const [blockerOpen, setBlockerOpen] = useState(false);

  const {
    data: task,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => apiClient.get<Task>(`/tasks/${id}`),
  });

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) =>
      apiClient.patch(`/tasks/${id}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      if (task?.quest_id) {
        void queryClient.invalidateQueries({
          queryKey: ['quests', task.quest_id],
        });
      }
    },
  });

  const unblockMutation = useMutation({
    mutationFn: () => apiClient.post(`/tasks/${id}/unblock`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', id] });
    },
  });

  const handleBlocked = () => {
    void queryClient.invalidateQueries({ queryKey: ['tasks', id] });
  };

  const canEdit = task?.is_own === true || isAdmin;
  const isOwn = task?.is_own === true;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Could not load this task. It may have been removed, or the request failed.
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard" />}
          >
            Return to dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isOverdue =
    task.due_date && !task.completed_at && isPast(parseISO(task.due_date));
  const effectiveXp =
    task.task_type !== 'core'
      ? Math.round(task.xp * TASK_TYPE_XP_WEIGHT[task.task_type])
      : task.xp;

  // Owner avatars — a stacked row so extra collaborators can slot in later.
  const ownerAvatars = task.owner
    ? [
        {
          name: task.owner.name,
          imageUrl: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(task.owner.name)}`,
        },
      ]
    : [];
  const visibleAvatars = ownerAvatars.slice(0, 3);
  const overflowAvatars = ownerAvatars.length - visibleAvatars.length;

  return (
      <div className="space-y-6">
        {/* Breadcrumb / Back link */}
        {task.quest_id && task.quest?.mission ? (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              <li className="min-w-0">
                <Link
                  href={`/missions/${task.quest.mission.id}`}
                  className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                >
                  {task.quest.mission.title}
                </Link>
              </li>
              <li><ChevronRight className="size-3" /></li>
              <li className="min-w-0">
                <Link
                  href={`/quests/${task.quest_id}`}
                  className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                >
                  {task.quest.title}
                </Link>
              </li>
              <li><ChevronRight className="size-3" /></li>
              <li className="min-w-0 text-foreground font-medium">{task.title}</li>
            </ol>
          </nav>
        ) : (
          <Link
            href={task.quest_id ? `/quests/${task.quest_id}` : `/missions/${task.mission_id}`}
            className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          >
            <ArrowLeft className="size-3" />
            Back to {task.quest_id ? 'quest' : 'mission'}
          </Link>
        )}

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{task.title}</h1>
            <ExportButton
              reportType="tasks"
              reportName="Tasks"
              isTimeSeries={false}
            />
            <Badge
              variant="secondary"
              className={getTaskStatusBadge(task.status)}
            >
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
            <Badge
              variant="secondary"
              className={getTaskTypeBadge(task.task_type)}
            >
              {TASK_TYPE_LABELS[task.task_type]}
            </Badge>
            <Badge
              variant="secondary"
              className={getPriorityBadge(task.priority)}
            >
              {TASK_PRIORITY_LABELS[task.priority]}
            </Badge>
            {task.valid && (
              <Badge variant="secondary" className={STATUS_BADGE.good}>
                Valid
              </Badge>
            )}
          </div>

          {!isOwn && !isAdmin && (
            <p className="text-sm text-muted-foreground">
              Read-only -- this task belongs to {task.owner?.name || 'another user'}
            </p>
          )}
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left column - 2/3 */}
          <div className="md:col-span-2 space-y-4">
            {/* Overview card */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold">Overview</h3>
                <p className="text-sm">
                  {task.description || (
                    <span className="text-muted-foreground">
                      No description
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>
                    Domain:{' '}
                    <Badge variant="secondary">
                      {TASK_DOMAIN_LABELS[task.domain]}
                    </Badge>
                  </span>
                  <span>
                    {task.xp} XP
                    {task.task_type !== 'core' &&
                      ` (${effectiveXp} XP effective at ${Math.round(TASK_TYPE_XP_WEIGHT[task.task_type] * 100)}%)`}
                  </span>
                  {task.due_date && (
                    <span className={isOverdue ? 'text-destructive' : ''}>
                      Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}
                      {isOverdue && ' \u00b7 Overdue'}
                    </span>
                  )}
                  <span>
                    Created:{' '}
                    {formatDistanceToNow(parseISO(task.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* People card */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold">People</h3>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {visibleAvatars.map((a) => (
                      <Avatar key={a.name} size="sm">
                        <AvatarImage src={a.imageUrl} alt="" />
                        <AvatarFallback>{initials(a.name)}</AvatarFallback>
                      </Avatar>
                    ))}
                    {overflowAvatars > 0 && (
                      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                        +{overflowAvatars}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {task.owner?.name || 'Unassigned'}
                    </p>
                    <p className="text-xs text-muted-foreground">Owner</p>
                  </div>
                </div>
                {task.creator && isAdmin && (
                  <div className="text-xs text-muted-foreground">
                    Created by: {task.creator.name}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status card */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold">Status</h3>
                <div className="flex items-center gap-3">
                  {canEdit ? (
                    <Select
                      value={task.status}
                      onValueChange={(val: unknown) =>
                        statusMutation.mutate(val as TaskStatus)
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableStatuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            {TASK_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      variant="secondary"
                      className={getTaskStatusBadge(task.status)}
                    >
                      {TASK_STATUS_LABELS[task.status]}
                    </Badge>
                  )}
                </div>

                {task.blocked && task.blocked_reason && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                    <p className="text-sm text-destructive font-medium">
                      Blocked
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {task.blocked_reason}
                    </p>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => unblockMutation.mutate()}
                        disabled={unblockMutation.isPending}
                      >
                        {unblockMutation.isPending
                          ? 'Unblocking...'
                          : 'Resolve blocker'}
                      </Button>
                    )}
                  </div>
                )}

                {canEdit && !task.blocked && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBlockerOpen(true)}
                  >
                    Report blocker
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Dependency card */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold">Dependencies</h3>
                {task.depends_on ? (
                  <div className="flex items-center gap-2">
                    <LinkIcon className="size-4 text-muted-foreground" />
                    <Link
                      href={`/tasks/${task.depends_on.id}`}
                      className="rounded-sm text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                    >
                      {task.depends_on.title}
                    </Link>
                    <Badge
                      variant="secondary"
                      className={getTaskStatusBadge(task.depends_on.status)}
                    >
                      {task.depends_on.status}
                    </Badge>
                    {task.depends_on.status !== 'done' && (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="size-3" />
                        Blocked by incomplete dependency
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No dependencies
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Evidence section */}
            <EvidenceSection task={task} isOwn={isOwn} isAdmin={isAdmin} />

            {/* Linked Resources */}
            {((task.linked_purchase_orders && task.linked_purchase_orders.length > 0) ||
              (task.linked_assets && task.linked_assets.length > 0)) && (
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <span className="text-sm font-bold">Linked Resources</span>

                  {task.linked_purchase_orders && task.linked_purchase_orders.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-muted-foreground">Purchase Orders</span>
                      {task.linked_purchase_orders.map((po) => (
                        <Link
                          key={po.id}
                          href={`/procurement/purchase-orders/${po.id}`}
                          className="flex items-center gap-2 text-sm rounded-md px-2 py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                        >
                          <Badge variant="outline" className="text-[10px]">PO</Badge>
                          <span className="flex-1 truncate">{po.vendor.name}</span>
                          <Badge variant="secondary" className="text-[10px]">{po.status}</Badge>
                        </Link>
                      ))}
                    </div>
                  )}

                  {task.linked_assets && task.linked_assets.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-muted-foreground">Assets</span>
                      {task.linked_assets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center gap-2 text-sm rounded-md px-2 py-1.5"
                        >
                          <Badge variant="outline" className="text-[10px]">Asset</Badge>
                          <span className="flex-1 truncate">{asset.name}</span>
                          <span className="text-xs text-muted-foreground">{asset.asset_type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column - 1/3 metadata */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                {task.quest_id && (
                  <div>
                    <p className="text-xs text-muted-foreground">Quest</p>
                    <Link
                      href={`/quests/${task.quest_id}`}
                      className="rounded-sm text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                    >
                      View quest
                    </Link>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Mission</p>
                  <Link
                    href={`/missions/${task.mission_id}`}
                    className="rounded-sm text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                  >
                    View mission
                  </Link>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Assigned to
                  </p>
                  <p className="text-sm">
                    {task.owner?.name || 'Unassigned'}
                  </p>
                </div>
                {isAdmin && task.creator && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Created by
                    </p>
                    <p className="text-sm">{task.creator.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">
                    Due date
                  </p>
                  <p
                    className={`text-sm ${isOverdue ? 'text-destructive' : ''}`}
                  >
                    {task.due_date
                      ? `${format(parseISO(task.due_date), 'MMM d, yyyy')}${isOverdue ? ' \u00b7 Overdue' : ''}`
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">XP value</p>
                  <p className="text-sm">{task.xp} XP</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge
                    variant="secondary"
                    className={getTaskStatusBadge(task.status)}
                  >
                    {TASK_STATUS_LABELS[task.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(parseISO(task.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Blocker dialog */}
        <BlockerDialog
          taskId={id}
          open={blockerOpen}
          onOpenChange={setBlockerOpen}
          onBlocked={handleBlocked}
        />
      </div>
  );
}
