import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeNumber } from '../import-types';
import type { CellError, ImportRow } from '../import-types';

export async function validateOpeningStockRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // ingredient — required, resolved by name to ingredient_id
  const ingredientName = (raw.ingredient ?? '').trim();
  let ingredientBaseUnit: string | null = null;
  if (!ingredientName) {
    errors.push({ field: 'ingredient', message: 'Required' });
  } else {
    const ingredient = await prisma.ingredient.findFirst({
      where: { name: { equals: ingredientName, mode: 'insensitive' } },
      select: { id: true, base_unit: true },
    });
    if (!ingredient) {
      errors.push({
        field: 'ingredient',
        message: `Ingredient '${ingredientName}' not found`,
      });
    } else {
      validated.ingredient_id = ingredient.id;
      ingredientBaseUnit = ingredient.base_unit;
    }
  }

  // zone_id — optional, overrides zone name if provided
  const zoneIdRaw = (raw.zone_id ?? '').trim();
  if (zoneIdRaw) {
    validated.zone_id = zoneIdRaw;
  } else {
    // zone — required unless zone_id provided, resolved with findMany ambiguity check (D-04)
    const zoneName = (raw.zone ?? '').trim();
    if (!zoneName) {
      errors.push({ field: 'zone', message: 'Required (or provide zone_id)' });
    } else {
      const zones = await prisma.zone.findMany({
        where: { name: { equals: zoneName, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (zones.length === 0) {
        errors.push({
          field: 'zone',
          message: `Zone '${zoneName}' not found`,
        });
      } else if (zones.length > 1) {
        errors.push({
          field: 'zone',
          message: `Multiple zones named '${zoneName}' found — use zone_id column`,
        });
      } else {
        validated.zone_id = zones[0].id;
      }
    }
  }

  // quantity — required, must be positive
  const quantityRaw = (raw.quantity ?? '').trim();
  if (!quantityRaw) {
    errors.push({ field: 'quantity', message: 'Required' });
  } else {
    const qty = sanitizeNumber(quantityRaw);
    if (qty === null) {
      errors.push({ field: 'quantity', message: 'Must be a positive number' });
    } else if (qty <= 0) {
      errors.push({ field: 'quantity', message: 'Must be a positive number' });
    } else {
      validated.quantity = qty;
    }
  }

  // unit — required, validate conversion path to ingredient base_unit
  const unit = (raw.unit ?? '').trim();
  if (!unit) {
    errors.push({ field: 'unit', message: 'Required' });
  } else {
    validated.unit = unit;
    // Check unit conversion path if ingredient was resolved
    if (ingredientBaseUnit) {
      if (unit.toLowerCase() !== ingredientBaseUnit.toLowerCase()) {
        const conversion = await prisma.unitConversion.findFirst({
          where: {
            OR: [
              { from_unit: unit, to_unit: ingredientBaseUnit },
              { from_unit: ingredientBaseUnit, to_unit: unit },
            ],
          },
        });
        if (!conversion) {
          errors.push({
            field: 'unit',
            message: `No unit conversion from '${unit}' to '${ingredientBaseUnit}'`,
          });
        }
      }
    }
  }

  // reason — optional, defaults to "Opening stock"
  const reason = (raw.reason ?? '').trim();
  validated.reason = reason || 'Opening stock';

  // Stock is additive (D-08) — NO duplicate detection
  const status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  return { rowIndex, raw, validated, errors, status };
}
