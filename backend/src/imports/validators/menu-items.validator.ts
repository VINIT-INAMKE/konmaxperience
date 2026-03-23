import { PrismaService } from '../../prisma/prisma.service';
import type { CellError, ImportRow } from '../import-types';
import { sanitizeNumber } from '../import-types';

export async function validateMenuItemRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // name — required
  const name = (raw.name ?? '').trim();
  if (!name) {
    errors.push({ field: 'name', message: 'Required' });
  } else {
    validated.name = name;
  }

  // brand — required, findMany ambiguity pattern (D-04)
  // Must be resolved BEFORE category lookup
  const brandName = (raw.brand ?? '').trim();
  if (!brandName) {
    errors.push({ field: 'brand', message: 'Required' });
  } else {
    const brands = await prisma.brand.findMany({
      where: { name: { equals: brandName, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (brands.length === 0) {
      errors.push({
        field: 'brand',
        message: `Brand '${brandName}' not found`,
      });
    } else if (brands.length > 1) {
      errors.push({
        field: 'brand',
        message: `Multiple brands named '${brandName}' found — use brand_id column`,
      });
    } else {
      validated.brand_id = brands[0].id;
    }
  }

  // recipe — required, must be approved
  const recipeName = (raw.recipe ?? '').trim();
  if (!recipeName) {
    errors.push({ field: 'recipe', message: 'Required' });
  } else {
    const recipe = await prisma.recipe.findFirst({
      where: { name: { equals: recipeName, mode: 'insensitive' } },
      select: { id: true, status: true },
    });
    if (!recipe) {
      errors.push({
        field: 'recipe',
        message: `Recipe '${recipeName}' not found`,
      });
    } else if (recipe.status !== 'approved') {
      errors.push({
        field: 'recipe',
        message: `Recipe '${recipeName}' is not approved — only approved recipes can be linked to menu items`,
      });
    } else {
      validated.recipe_id = recipe.id;
    }
  }

  // category — required, needs brand resolved first
  const categoryName = (raw.category ?? '').trim();
  if (!categoryName) {
    errors.push({ field: 'category', message: 'Required' });
  } else if (validated.brand_id) {
    const category = await prisma.menuCategory.findFirst({
      where: {
        name: { equals: categoryName, mode: 'insensitive' },
        brand_id: validated.brand_id as string,
      },
      select: { id: true },
    });
    if (!category) {
      errors.push({
        field: 'category',
        message: `Category '${categoryName}' not found in brand`,
      });
    } else {
      validated.category_id = category.id;
    }
  }

  // base_price — required, >= 0.01
  const priceRaw = (raw.base_price ?? '').trim();
  if (!priceRaw) {
    errors.push({ field: 'base_price', message: 'Required' });
  } else {
    const val = sanitizeNumber(priceRaw);
    if (val === null || val < 0.01) {
      errors.push({
        field: 'base_price',
        message: 'Must be a number >= 0.01',
      });
    } else {
      validated.base_price = val;
    }
  }

  // available — optional, parse boolean, default true
  const availableRaw = (raw.available ?? '').trim().toLowerCase();
  if (availableRaw) {
    const trueValues = ['true', 'yes', '1'];
    const falseValues = ['false', 'no', '0'];
    if (trueValues.includes(availableRaw)) {
      validated.available = true;
    } else if (falseValues.includes(availableRaw)) {
      validated.available = false;
    } else {
      errors.push({
        field: 'available',
        message:
          "Invalid value. Accepted values: true, false, yes, no, 1, 0",
      });
    }
  } else {
    validated.available = true;
  }

  // Duplicate detection: name + category_id
  let existingId: string | undefined;
  let status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  if (errors.length === 0 && validated.category_id && validated.name) {
    const existing = await prisma.menuItem.findFirst({
      where: {
        name: { equals: validated.name as string, mode: 'insensitive' },
        category_id: validated.category_id as string,
      },
      select: { id: true },
    });
    if (existing) {
      existingId = existing.id;
      status = 'duplicate';
    }
  }

  return { rowIndex, raw, validated, errors, status, existingId };
}
