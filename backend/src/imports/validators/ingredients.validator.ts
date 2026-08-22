import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeNumber } from '../import-types';
import type { CellError, ImportRow } from '../import-types';

const VALID_BASE_UNITS = [
  'g', 'kg', 'ml', 'L', 'pieces', 'dozen', 'oz', 'lb',
];

export async function validateIngredientRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // name -- required string
  const name = (raw.name ?? '').trim();
  if (!name) {
    errors.push({ field: 'name', message: 'Required' });
  } else {
    validated.name = name;
  }

  // category -- required, resolved by name to an IngredientCategory row (D-29).
  // The legacy free-string Ingredient.category column no longer exists; the
  // spreadsheet column now names a row in IngredientCategory.
  const category = (raw.category ?? '').trim();
  if (!category) {
    errors.push({ field: 'category', message: 'Required' });
  } else {
    const match = await prisma.ingredientCategory.findFirst({
      where: { name: { equals: category, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!match) {
      errors.push({
        field: 'category',
        message: `Unknown category '${category}'. It must match an existing ingredient category name.`,
      });
    } else {
      validated.category_id = match.id;
    }
  }

  // base_unit -- required enum (D-29)
  const baseUnit = (raw.base_unit ?? '').trim();
  if (!baseUnit) {
    errors.push({ field: 'base_unit', message: 'Required' });
  } else if (!VALID_BASE_UNITS.includes(baseUnit)) {
    errors.push({
      field: 'base_unit',
      message: `Invalid base_unit '${baseUnit}'. Valid values: ${VALID_BASE_UNITS.join(', ')}`,
    });
  } else {
    validated.base_unit = baseUnit;
  }

  // min_stock_level -- required Decimal with sanitizeNumber (D-31)
  const mslRaw = (raw.min_stock_level ?? '').trim();
  if (!mslRaw) {
    errors.push({ field: 'min_stock_level', message: 'Required' });
  } else {
    const mslVal = sanitizeNumber(mslRaw);
    if (mslVal === null) {
      errors.push({ field: 'min_stock_level', message: 'Must be a number' });
    } else if (mslVal < 0) {
      errors.push({
        field: 'min_stock_level',
        message: 'min_stock_level must be 0 or greater',
      });
    } else {
      validated.min_stock_level = mslVal;
    }
  }

  // Duplicate detection by name (case-insensitive)
  let existingId: string | undefined;
  let status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  if (name && errors.length === 0) {
    const existing = await prisma.ingredient.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true, base_unit: true },
    });
    if (existing) {
      existingId = existing.id;
      status = 'duplicate';
      // D-28: Check if base_unit would change
      if (validated.base_unit && existing.base_unit !== validated.base_unit) {
        errors.push({
          field: 'base_unit',
          message: `Cannot change base_unit — stock records use ${existing.base_unit}`,
        });
        status = 'blocked';
      }
    }
  }

  return { rowIndex, raw, validated, errors, status, existingId };
}
