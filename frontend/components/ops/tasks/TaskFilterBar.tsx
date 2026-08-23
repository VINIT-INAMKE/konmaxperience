'use client';

/**
 * `IA-04` — the `/tasks` filter row.
 *
 * Every control reads and writes `useSearchParams()`, so the filter state is the
 * URL: a filtered board is linkable, `?status=blocked` from the dashboards lands
 * on the right rows, and the back button restores the previous set. Nothing is
 * mirrored into component state, which is what keeps the two in sync.
 *
 * `mine`, `status`, `quest_id` and `task_type` are handed to `GET /tasks`;
 * `priority` has no server-side filter and narrows the rows already loaded — the
 * control says so rather than pretending otherwise.
 */

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Check, Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { Quest } from '@/lib/types/quests';
import type { TaskPriority, TaskStatus, TaskType } from '@/lib/types/tasks';
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from '@/lib/types/tasks';
import {
  hasActiveTaskFilters,
  isMineOn,
  parsePriorityParam,
  parseStatusParam,
  parseTypeParam,
} from '@/lib/types/tasks-page';

/** Every `TaskStatus`, in the order the board reads them. */
const FILTERABLE_STATUSES: TaskStatus[] = [
  'todo',
  'doing',
  'blocked',
  'done',
  'cancelled',
];

const FILTERABLE_TYPES: TaskType[] = ['core', 'adhoc', 'improvement'];
const FILTERABLE_PRIORITIES: TaskPriority[] = [
  'critical',
  'high',
  'medium',
  'low',
];

const ALL = '__all__';

interface TaskFilterBarProps {
  /** Rows currently rendered, after the client-side priority narrowing. */
  resultCount: number;
  /** True while `GET /tasks` still has pages the user has not asked for. */
  hasMore?: boolean;
  /** True while the first page is in flight — the count is not meaningful yet. */
  isLoading?: boolean;
}

export function TaskFilterBar({
  resultCount,
  hasMore = false,
  isLoading = false,
}: TaskFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const roleCode = useAuthStore((s) => s.user?.roleCode);
  const [statusOpen, setStatusOpen] = useState(false);

  const mine = isMineOn(params, roleCode);
  const statuses = parseStatusParam(params.get('status'));
  const taskType = parseTypeParam(params.get('task_type'));
  const priority = parsePriorityParam(params.get('priority'));
  const questId = params.get('quest_id');
  const isFiltered = hasActiveTaskFilters(params, roleCode);

  const setParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  /**
   * The quest picker's options. `mine=1` keeps the list to the caller's own
   * quests, which is what makes it short enough to scan.
   */
  const {
    data: quests = [],
    isLoading: questsLoading,
    isError: questsError,
  } = useQuery({
    queryKey: ['quests', { mine: true, forFilter: true }],
    queryFn: () => apiClient.get<Quest[]>('/quests?mine=1&limit=100'),
    staleTime: 60_000,
  });

  /**
   * The combobox works on labels, so a label → id map carries the selection.
   * Titles can repeat across missions; the week number disambiguates them.
   */
  const { questLabels, labelToId, idToLabel } = useMemo(() => {
    const labelToIdMap = new Map<string, string>();
    const idToLabelMap = new Map<string, string>();
    const labels: string[] = [];
    for (const quest of quests) {
      let label = `${quest.title} · Week ${quest.week_number}`;
      let suffix = 2;
      while (labelToIdMap.has(label)) {
        label = `${quest.title} · Week ${quest.week_number} (${suffix++})`;
      }
      labelToIdMap.set(label, quest.id);
      idToLabelMap.set(quest.id, label);
      labels.push(label);
    }
    return {
      questLabels: labels,
      labelToId: labelToIdMap,
      idToLabel: idToLabelMap,
    };
  }, [quests]);

  const selectedQuestLabel = questId ? (idToLabel.get(questId) ?? null) : null;

  const toggleStatus = (status: TaskStatus) => {
    const next = statuses.includes(status)
      ? statuses.filter((s) => s !== status)
      : [...statuses, status];
    setParams((p) => {
      if (next.length === 0) p.delete('status');
      else p.set('status', next.join(','));
    });
  };

  const clearAll = () => {
    setParams((p) => {
      for (const key of [
        'mine',
        'status',
        'task_type',
        'priority',
        'quest_id',
        'mission_id',
      ]) {
        p.delete(key);
      }
    });
  };

  const statusSummary =
    statuses.length === 0
      ? 'Any status'
      : statuses.length === 1
        ? TASK_STATUS_LABELS[statuses[0]]
        : `${statuses.length} statuses`;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2">
      {/* Mine — the one filter with a role-derived default */}
      <Button
        size="sm"
        variant={mine ? 'default' : 'outline'}
        aria-pressed={mine}
        onClick={() =>
          setParams((p) => {
            p.set('mine', mine ? '0' : '1');
          })
        }
      >
        {mine && <Check className="size-3.5" />}
        Mine
      </Button>

      {/* Status — multi-select, serialised comma-separated into `status=` */}
      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
        <PopoverTrigger
          render={<Button size="sm" variant="outline" />}
          aria-label={`Filter by status — ${statusSummary}`}
        >
          <Filter className="size-3.5" />
          {statusSummary}
          {statuses.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {statuses.length}
            </Badge>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 gap-1 p-1.5">
          {FILTERABLE_STATUSES.map((status) => {
            const checked = statuses.includes(status);
            return (
              <label
                key={status}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-raised"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleStatus(status)}
                />
                {TASK_STATUS_LABELS[status]}
              </label>
            );
          })}
        </PopoverContent>
      </Popover>

      {/* Quest — combobox over the caller's own quests */}
      <div className="min-w-[12rem] flex-1 basis-48">
        {questsLoading ? (
          <Skeleton className="h-8 w-full rounded-lg" />
        ) : questsError ? (
          <span className="text-xs text-ink-muted">
            Quest filter unavailable
          </span>
        ) : (
          <Combobox
            value={selectedQuestLabel}
            onValueChange={(value: unknown) => {
              const label = value as string | null;
              const id = label ? labelToId.get(label) : undefined;
              setParams((p) => {
                if (id) p.set('quest_id', id);
                else p.delete('quest_id');
              });
            }}
          >
            <ComboboxInput
              placeholder="Any quest"
              aria-label="Filter by quest"
              showClear={!!questId}
            />
            <ComboboxContent>
              <ComboboxEmpty>No quests found.</ComboboxEmpty>
              <ComboboxList>
                {questLabels.map((label) => (
                  <ComboboxItem key={label} value={label}>
                    {label}
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        )}
      </div>

      {/* Type — server-side (`GET /tasks` filters on `task_type`) */}
      <Select
        value={taskType ?? ALL}
        onValueChange={(value: unknown) =>
          setParams((p) => {
            const next = (value ?? ALL) as string;
            if (next === ALL) p.delete('task_type');
            else p.set('task_type', next);
          })
        }
      >
        <SelectTrigger size="sm" className="w-32" aria-label="Filter by type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any type</SelectItem>
          {FILTERABLE_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {TASK_TYPE_LABELS[type]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/*
        Priority — client-side only. `GET /tasks` has no priority filter, so this
        narrows the pages already loaded rather than re-querying. Said plainly in
        the control's title so nobody reads the count as a table-wide total.
      */}
      <Select
        value={priority ?? ALL}
        onValueChange={(value: unknown) =>
          setParams((p) => {
            const next = (value ?? ALL) as string;
            if (next === ALL) p.delete('priority');
            else p.set('priority', next);
          })
        }
      >
        <SelectTrigger
          size="sm"
          className="w-36"
          aria-label="Filter by priority — narrows the tasks already loaded"
          title="Narrows the tasks already loaded; the API has no priority filter."
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any priority</SelectItem>
          {FILTERABLE_PRIORITIES.map((value) => (
            <SelectItem key={value} value={value}>
              {TASK_PRIORITY_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isFiltered && (
        <Button size="sm" variant="ghost" onClick={clearAll}>
          <X className="size-3.5" />
          Clear
        </Button>
      )}

      <span
        className="ml-auto text-xs tabular-nums text-ink-muted"
        aria-live="polite"
      >
        {isLoading
          ? 'Loading…'
          : `${resultCount} task${resultCount === 1 ? '' : 's'}${hasMore ? '+' : ''}`}
      </span>
    </div>
  );
}
