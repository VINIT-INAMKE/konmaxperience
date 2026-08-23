import type { MeterMode } from '@prisma/client';
import { clamp, round2 } from './derived-meters';

/**
 * SPEC §4.3 / decision 10 — the published `ReadinessMeter.current_value`:
 *   task_driven -> task_value
 *   derived     -> derived_value (0 until first computed)
 *   hybrid      -> 0.5 x task_value + 0.5 x derived_value
 *
 * The single blend rule, imported by both `ReadinessDerivationService` and
 * `EvidenceService`, so the task-driven half and the formula half can never
 * publish `current_value` by two different rules.
 *
 * `MeterMode` is imported as a *type only*: Prisma 6 generates it as a string
 * union, so this file keeps zero runtime dependency on `@prisma/client`.
 */
export function blendMeterValue(
  mode: MeterMode,
  taskValue: number,
  derivedValue: number | null,
): number {
  switch (mode) {
    case 'derived':
      return round2(clamp(derivedValue ?? 0));
    case 'hybrid':
      return round2(
        clamp(0.5 * clamp(taskValue) + 0.5 * clamp(derivedValue ?? 0)),
      );
    case 'task_driven':
    default:
      return round2(clamp(taskValue));
  }
}
