import { BadRequestException } from '@nestjs/common';

type EnumLike = Record<string, string>;

/**
 * Narrows an untrusted string to a Prisma enum member. Prisma generates each
 * enum as a frozen object of string values plus a string-union type, so the
 * object doubles as the runtime allow-list and the type parameter carries the union.
 */
export function parseEnum<T extends EnumLike>(
  enumObject: T,
  raw: string,
  field: string,
): T[keyof T] {
  const values = Object.values(enumObject);
  if (!values.includes(raw)) {
    throw new BadRequestException(
      `Invalid ${field}: "${raw}". Allowed: ${values.join(', ')}`,
    );
  }
  return raw as T[keyof T];
}

export function isEnumValue<T extends EnumLike>(
  enumObject: T,
  raw: unknown,
): raw is T[keyof T] {
  return typeof raw === 'string' && Object.values(enumObject).includes(raw);
}
