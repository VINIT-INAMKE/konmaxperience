'use client';

import { useMemo, useState } from 'react';
import type { AssembleComponent } from '@/lib/types/kitchen';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

interface AssembleChecklistProps {
  components: AssembleComponent[];
  onAllChecked: () => void;
}

export function AssembleChecklist({ components, onAllChecked }: AssembleChecklistProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const allChecked = useMemo(
    () => components.length > 0 && components.every((c) => checked.has(c.recipe_id)),
    [components, checked],
  );

  const toggleComponent = (recipeId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) {
        next.delete(recipeId);
      } else {
        next.add(recipeId);
      }
      return next;
    });
  };

  return (
    <div className="pl-8 py-2 space-y-2">
      {components.map((comp) => {
        const isChecked = checked.has(comp.recipe_id);
        return (
          <label
            key={comp.recipe_id}
            className={`flex items-center gap-3 cursor-pointer text-sm ${
              isChecked ? 'line-through text-muted-foreground' : ''
            }`}
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => toggleComponent(comp.recipe_id)}
            />
            <span>{comp.recipe_name}</span>
            <span className="text-muted-foreground font-mono text-xs">
              {comp.quantity} {comp.unit}
            </span>
          </label>
        );
      })}

      {allChecked && (
        <Button size="sm" onClick={onAllChecked}>
          Mark Complete
        </Button>
      )}
    </div>
  );
}
