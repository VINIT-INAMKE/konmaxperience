'use client';

import { ReadinessMeterRing } from './ReadinessMeterRing';
import { MeterDetailPanel } from './MeterDetailPanel';
import type { MeterMode, ReadinessMeter } from '@/lib/types/readiness';

interface ReadinessGridProps {
  meters: ReadinessMeter[];
  selectedMeterId: string | null;
  onSelectMeter: (id: string | null) => void;
}

const SECTIONS: {
  key: string;
  title: string;
  blurb: string;
  modes: MeterMode[];
}[] = [
  {
    key: 'derived',
    title: 'Derived from operations',
    blurb:
      'Computed from live ops data — catalog, procurement, sales and quality — and recomputed nightly. Hybrid meters blend that with validated tasks 50/50.',
    modes: ['derived', 'hybrid'],
  },
  {
    key: 'task-driven',
    title: 'Task-driven',
    blurb: 'Moves only when a task is validated with approved evidence.',
    modes: ['task_driven'],
  },
];

export function ReadinessGrid({
  meters,
  selectedMeterId,
  onSelectMeter,
}: ReadinessGridProps) {
  const selectedMeter = selectedMeterId
    ? meters.find((m) => m.id === selectedMeterId) ?? null
    : null;

  const sections = SECTIONS.map((section) => ({
    ...section,
    meters: meters.filter((m) => section.modes.includes(m.mode)),
  })).filter((section) => section.meters.length > 0);

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.key} className="space-y-4">
          <div className="border-b border-line pb-3">
            <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
              {section.title}
              <span className="ml-2 font-normal normal-case text-ink-faint">
                {section.meters.length}
              </span>
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-ink-muted">
              {section.blurb}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {section.meters.map((meter) => (
              <div key={meter.id} className="flex justify-center">
                <ReadinessMeterRing
                  meter={meter}
                  selected={meter.id === selectedMeterId}
                  onClick={() =>
                    onSelectMeter(meter.id === selectedMeterId ? null : meter.id)
                  }
                />
              </div>
            ))}
          </div>

          {selectedMeter &&
            section.meters.some((m) => m.id === selectedMeter.id) && (
              <MeterDetailPanel
                meter={selectedMeter}
                onClose={() => onSelectMeter(null)}
              />
            )}
        </section>
      ))}
    </div>
  );
}
