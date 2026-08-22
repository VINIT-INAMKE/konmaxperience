import { BadRequestException } from '@nestjs/common';
import { TaskStatus, MovementType } from '@prisma/client';
import { parseEnum, isEnumValue } from './parse-enum';

describe('parse-enum', () => {
  it('returns the value when it is a member', () => {
    expect(parseEnum(TaskStatus, 'doing', 'status')).toBe('doing');
    expect(parseEnum(MovementType, 'purchase_received', 'movement_type')).toBe(
      'purchase_received',
    );
  });

  it('throws BadRequestException listing the allowed values', () => {
    expect(() => parseEnum(TaskStatus, 'in_progress', 'status')).toThrow(
      BadRequestException,
    );
    expect(() => parseEnum(TaskStatus, 'in_progress', 'status')).toThrow(
      /Allowed: todo, doing, done, blocked, cancelled/,
    );
  });

  it('isEnumValue narrows without throwing', () => {
    expect(isEnumValue(TaskStatus, 'todo')).toBe(true);
    expect(isEnumValue(TaskStatus, 'nope')).toBe(false);
    expect(isEnumValue(TaskStatus, 42)).toBe(false);
  });
});
