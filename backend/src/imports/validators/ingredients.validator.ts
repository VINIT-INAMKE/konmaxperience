import { PrismaService } from '../../prisma/prisma.service';
import type { CellError, ImportRow } from '../import-types';

export async function validateIngredientRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // name — required string
  const name = (raw.name ?? '').trim();
  if (!name) {
    errors.push({ field: 'name', message: 'Required' });
  } else {
    validated.name = name;
  }

  // category — required string
  const category = (raw.category ?? '').trim();
  if (!category) {
    errors.push({ field: 'category', message: 'Required' });
  } else {
    validated.category = category;
  }

  // base_unit — required string
  const baseUnit = (raw.base_unit ?? '').trim();
  if (!baseUnit) {
    errors.push({ field: 'base_unit', message: 'Required' });
  } else {
    validated.base_unit = baseUnit;
  }

  // min_stock_level — required Decimal
  const mslRaw = (raw.min_stock_level ?? '').trim();
  if (!mslRaw) {
    errors.push({ field: 'min_stock_level', message: 'Required' });
  } else if (isNaN(parseFloat(mslRaw))) {
    errors.push({ field: 'min_stock_level', message: 'Must be a number' });
  } else {
    validated.min_stock_level = parseFloat(mslRaw);
  }

  // Duplicate detection by name (case-insensitive) per D-18
  let existingId: string | undefined;
  let status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  if (name && errors.length === 0) {
    const existing = await prisma.ingredient.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      existingId = existing.id;
      status = 'duplicate';
    }
  }

  return { rowIndex, raw, validated, errors, status, existingId };
}
