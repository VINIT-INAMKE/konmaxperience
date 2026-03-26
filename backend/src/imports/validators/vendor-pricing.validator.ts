import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeNumber, parseDateUTC } from '../import-types';
import type { CellError, ImportRow } from '../import-types';

export async function validateVendorPricingRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // vendor — required, resolved by name to vendor_id
  const vendorName = (raw.vendor ?? '').trim();
  if (!vendorName) {
    errors.push({ field: 'vendor', message: 'Required' });
  } else {
    const vendor = await prisma.vendor.findFirst({
      where: { name: { equals: vendorName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!vendor) {
      errors.push({ field: 'vendor', message: 'Vendor not found in system' });
    } else {
      validated.vendor_id = vendor.id;
    }
  }

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
        message: 'Ingredient not found in system',
      });
    } else {
      validated.ingredient_id = ingredient.id;
      ingredientBaseUnit = ingredient.base_unit;
    }
  }

  // price — required Decimal
  const priceRaw = (raw.price ?? '').trim();
  if (!priceRaw) {
    errors.push({ field: 'price', message: 'Required' });
  } else {
    const p = sanitizeNumber(priceRaw);
    if (p === null) {
      errors.push({ field: 'price', message: 'Must be a number' });
    } else if (p < 0.01) {
      errors.push({ field: 'price', message: 'Price must be at least 0.01' });
    } else {
      validated.price = p;
    }
  }

  // unit — required string
  const unit = (raw.unit ?? '').trim();
  if (!unit) {
    errors.push({ field: 'unit', message: 'Required' });
  } else {
    validated.unit = unit;
  }

  // effective_date — required DateTime, expected YYYY-MM-DD
  const dateRaw = (raw.effective_date ?? '').trim();
  if (!dateRaw) {
    errors.push({ field: 'effective_date', message: 'Required' });
  } else {
    const parsed = parseDateUTC(dateRaw);
    if (!parsed) {
      errors.push({
        field: 'effective_date',
        message: 'Invalid date (expected YYYY-MM-DD)',
      });
    } else {
      validated.effective_date = parsed;
    }
  }

  // Check unit conversion path from price unit to ingredient base_unit
  const warnings: CellError[] = [];
  if (ingredientBaseUnit && validated.unit) {
    const priceUnit = validated.unit as string;
    if (priceUnit !== ingredientBaseUnit) {
      const conversion = await prisma.unitConversion.findFirst({
        where: {
          OR: [
            {
              from_unit: { equals: priceUnit, mode: 'insensitive' },
              to_unit: { equals: ingredientBaseUnit, mode: 'insensitive' },
            },
            {
              from_unit: { equals: ingredientBaseUnit, mode: 'insensitive' },
              to_unit: { equals: priceUnit, mode: 'insensitive' },
            },
          ],
        },
      });
      if (!conversion) {
        warnings.push({
          field: 'unit',
          message: `No unit conversion from ${priceUnit} to ${ingredientBaseUnit} — cost calculations may be incomplete`,
        });
      }
    }
  }

  // Vendor pricing duplicate detection: same vendor_id + ingredient_id + effective_date
  let existingId: string | undefined;
  let status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  if (
    errors.length === 0 &&
    validated.vendor_id &&
    validated.ingredient_id &&
    validated.effective_date
  ) {
    const existing = await prisma.vendorPrice.findFirst({
      where: {
        vendor_id: validated.vendor_id as string,
        ingredient_id: validated.ingredient_id as string,
        effective_date: validated.effective_date as Date,
      },
      select: { id: true },
    });
    if (existing) {
      existingId = existing.id;
      status = 'duplicate';
    }
  }

  return { rowIndex, raw, validated, errors, warnings, status, existingId };
}
