'use client';

import { useId } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SpineGroupProps {
  /** Stable id from `SpineGroupDef.id` — the localStorage key stores these. */
  id: string;
  label: string;
  collapsed: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

/**
 * A collapsible spine group. The grid-rows transition keeps the content in the
 * DOM (so `Tab` order stays honest) while animating height; `motion-reduce`
 * turns the animation off entirely.
 */
export function SpineGroup({
  id,
  label,
  collapsed,
  onToggle,
  children,
}: SpineGroupProps) {
  const regionId = useId();

  return (
    <div className="pt-3 first:pt-1">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={!collapsed}
        aria-controls={regionId}
        className={[
          'group flex w-full items-center justify-between rounded-md px-2 py-1',
          'transition-colors motion-reduce:transition-none hover:bg-surface-raised',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
        ].join(' ')}
      >
        <span className="text-[11px] font-medium tracking-wider text-ink-faint uppercase group-hover:text-ink-muted">
          {label}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-3 text-ink-faint transition-transform duration-200 group-hover:text-ink-muted motion-reduce:transition-none ${
            collapsed ? '-rotate-90' : ''
          }`}
        />
      </button>
      <div
        id={regionId}
        role="region"
        aria-label={label}
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
        }`}
      >
        {/* `inert` (not `hidden`) keeps the grid-rows animation alive while
            taking collapsed links out of the tab order. */}
        <div inert={collapsed} className="min-h-0 space-y-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
