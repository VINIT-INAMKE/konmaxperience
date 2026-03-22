'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { QuestKanbanCard } from './QuestKanbanCard';
import type { Quest } from '@/lib/types/quests';

interface QuestKanbanColumnProps {
  title: string;
  quests: Quest[];
  accentClass: string;
}

export function QuestKanbanColumn({
  title,
  quests,
  accentClass,
}: QuestKanbanColumnProps) {
  return (
    <div className={`w-full sm:min-w-[240px] border-l-4 ${accentClass} rounded-lg bg-muted/30 p-4`}>
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold uppercase">{title}</span>
        <Badge variant="secondary">
          {quests.length} quest{quests.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Quest list */}
      <ScrollArea className="max-h-[60vh]">
        <div className="space-y-3">
          {quests.length > 0 ? (
            quests.map((quest) => (
              <QuestKanbanCard key={quest.id} quest={quest} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No quests
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
