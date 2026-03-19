'use client';

import { LayoutGrid, List } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TaskViewToggleProps {
  view: 'kanban' | 'list';
  onViewChange: (view: 'kanban' | 'list') => void;
}

export function TaskViewToggle({ view, onViewChange }: TaskViewToggleProps) {
  return (
    <Tabs
      value={view}
      onValueChange={(val: unknown) => onViewChange(val as 'kanban' | 'list')}
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
