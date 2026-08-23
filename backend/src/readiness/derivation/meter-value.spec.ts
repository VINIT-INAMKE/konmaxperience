import { MeterMode } from '@prisma/client';
import { READINESS_METERS } from '../../../prisma/seed-data/reference';
import { blendMeterValue } from './meter-value';

describe('blendMeterValue', () => {
  describe('task_driven', () => {
    it('publishes the task value', () => {
      expect(blendMeterValue(MeterMode.task_driven, 72, null)).toBe(72);
    });

    it('ignores a derived value that a mis-seeded meter happens to carry', () => {
      expect(blendMeterValue(MeterMode.task_driven, 72, 100)).toBe(72);
    });

    it('clamps into [0, 100]', () => {
      expect(blendMeterValue(MeterMode.task_driven, 140, null)).toBe(100);
      expect(blendMeterValue(MeterMode.task_driven, -20, null)).toBe(0);
      expect(blendMeterValue(MeterMode.task_driven, NaN, null)).toBe(0);
    });

    it('passes the boundaries through', () => {
      expect(blendMeterValue(MeterMode.task_driven, 0, null)).toBe(0);
      expect(blendMeterValue(MeterMode.task_driven, 100, null)).toBe(100);
    });

    it('rounds to two decimals', () => {
      expect(blendMeterValue(MeterMode.task_driven, 66.6666, null)).toBe(66.67);
    });
  });

  describe('derived', () => {
    it('publishes the derived value and ignores the task value', () => {
      expect(blendMeterValue(MeterMode.derived, 90, 40)).toBe(40);
    });

    it('publishes 0 until the formula has run once', () => {
      expect(blendMeterValue(MeterMode.derived, 90, null)).toBe(0);
    });

    it('clamps into [0, 100]', () => {
      expect(blendMeterValue(MeterMode.derived, 0, 140)).toBe(100);
      expect(blendMeterValue(MeterMode.derived, 0, -20)).toBe(0);
      expect(blendMeterValue(MeterMode.derived, 0, NaN)).toBe(0);
    });

    it('rounds to two decimals', () => {
      expect(blendMeterValue(MeterMode.derived, 0, 33.3333)).toBe(33.33);
    });
  });

  describe('hybrid', () => {
    it('blends the two halves 50/50', () => {
      expect(blendMeterValue(MeterMode.hybrid, 60, 40)).toBe(50);
    });

    it('halves the task value when the derived half has never been computed', () => {
      expect(blendMeterValue(MeterMode.hybrid, 60, null)).toBe(30);
    });

    it('scores 0 when both halves are empty', () => {
      expect(blendMeterValue(MeterMode.hybrid, 0, null)).toBe(0);
    });

    it('scores 100 only when both halves are full', () => {
      expect(blendMeterValue(MeterMode.hybrid, 100, 100)).toBe(100);
      expect(blendMeterValue(MeterMode.hybrid, 100, 99)).toBe(99.5);
    });

    it('clamps each half before blending, so one runaway half cannot lift the other', () => {
      expect(blendMeterValue(MeterMode.hybrid, 200, 0)).toBe(50);
      expect(blendMeterValue(MeterMode.hybrid, 0, 200)).toBe(50);
      expect(blendMeterValue(MeterMode.hybrid, -50, 50)).toBe(25);
      expect(blendMeterValue(MeterMode.hybrid, 200, 200)).toBe(100);
      expect(blendMeterValue(MeterMode.hybrid, NaN, 50)).toBe(25);
      expect(blendMeterValue(MeterMode.hybrid, 50, NaN)).toBe(25);
    });

    it('rounds to two decimals', () => {
      expect(blendMeterValue(MeterMode.hybrid, 33.3333, 0)).toBe(16.67);
    });
  });

  it('falls back to the task-driven rule for an unrecognised mode', () => {
    expect(blendMeterValue('legacy' as MeterMode, 61, 99)).toBe(61);
  });

  it('is deterministic', () => {
    for (const mode of [
      MeterMode.task_driven,
      MeterMode.derived,
      MeterMode.hybrid,
    ]) {
      expect(blendMeterValue(mode, 41.5, 22.25)).toBe(
        blendMeterValue(mode, 41.5, 22.25),
      );
    }
  });

  it('keeps every seeded meter inside [0, 100] for any half', () => {
    for (const meter of READINESS_METERS) {
      for (const taskValue of [0, 55, 100, 140, -10]) {
        for (const derivedValue of [null, 0, 55, 100, 140, -10]) {
          const value = blendMeterValue(meter.mode, taskValue, derivedValue);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});
