'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type TaskView = 'kanban' | 'list';

interface TaskViewToggleProps {
  view: TaskView;
  onViewChange: (view: TaskView) => void;
}

function isTaskView(value: unknown): value is TaskView {
  return value === 'kanban' || value === 'list';
}

/**
 * `localStorage` is an external store, so it is read through
 * `useSyncExternalStore` rather than an effect that calls `setState`. That gives
 * a distinct server snapshot — always `fallback` — which React also uses while
 * hydrating, so the stored choice applies without a markup mismatch and without
 * a cascading render.
 */
const listeners = new Set<() => void>();

/** Last known value per key, so the toggle still works when storage throws. */
const memory = new Map<string, TaskView>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // Another tab writing the same key.
  window.addEventListener('storage', onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

function readView(storageKey: string): TaskView | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (isTaskView(stored)) return stored;
  } catch {
    // Storage unavailable (private window, site data blocked) — use memory.
  }
  return memory.get(storageKey) ?? null;
}

function writeView(storageKey: string, next: TaskView): void {
  memory.set(storageKey, next);
  try {
    window.localStorage.setItem(storageKey, next);
  } catch {
    // Storage unavailable — the choice still holds for this session.
  }
  for (const listener of listeners) listener();
}

export function useTaskViewPreference(
  storageKey: string,
  fallback: TaskView = 'list',
): [TaskView, (next: TaskView) => void] {
  const view = useSyncExternalStore(
    subscribe,
    () => readView(storageKey) ?? fallback,
    () => fallback,
  );

  const update = useCallback(
    (next: TaskView) => writeView(storageKey, next),
    [storageKey],
  );

  return [view, update];
}

export function TaskViewToggle({ view, onViewChange }: TaskViewToggleProps) {
  return (
    <Tabs
      value={view}
      onValueChange={(val: unknown) =>
        onViewChange(isTaskView(val) ? val : 'list')
      }
    >
      <TabsList>
        <TabsTrigger value="kanban" aria-label="Kanban view" aria-pressed={view === 'kanban'}>
          <LayoutGrid className="size-4" />
          Board
        </TabsTrigger>
        <TabsTrigger value="list" aria-label="List view" aria-pressed={view === 'list'}>
          <List className="size-4" />
          List
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
