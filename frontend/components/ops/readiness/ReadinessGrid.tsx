'use client';

import { BlurFade } from '@/components/ui/blur-fade';
import { ReadinessMeterRing } from './ReadinessMeterRing';
import { MeterDetailPanel } from './MeterDetailPanel';
import type { ReadinessMeter } from '@/lib/types/readiness';

interface ReadinessGridProps {
  meters: ReadinessMeter[];
  selectedMeterId: string | null;
  onSelectMeter: (id: string | null) => void;
}

export function ReadinessGrid({
  meters,
  selectedMeterId,
  onSelectMeter,
}: ReadinessGridProps) {
  const selectedMeter = selectedMeterId
    ? meters.find((m) => m.id === selectedMeterId) ?? null
    : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {meters.map((meter, index) => (
        <BlurFade key={meter.id} delay={index * 0.05} className="flex justify-center">
          <ReadinessMeterRing
            meter={meter}
            selected={meter.id === selectedMeterId}
            onClick={() =>
              onSelectMeter(meter.id === selectedMeterId ? null : meter.id)
            }
          />
        </BlurFade>
      ))}

      {/* Detail panel spans full width below the grid */}
      {selectedMeter && (
        <MeterDetailPanel
          meterId={selectedMeter.id}
          meterName={selectedMeter.name}
          currentValue={selectedMeter.current_value}
          onClose={() => onSelectMeter(null)}
        />
      )}
    </div>
  );
}
