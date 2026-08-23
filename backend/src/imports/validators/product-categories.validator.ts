import { PrismaService } from '../../prisma/prisma.service';
import type { CellError, ImportRow } from '../import-types';
import { sanitizeNumber, slugify } from '../import-types';

export async function validateProductCategoryRow(
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
    // `ProductCategory.slug` is required and unique per node; the sheet has no
    // slug column, so it is derived from the name.
    const slug = slugify(name);
    if (!slug) {
      errors.push({
        field: 'name',
        message: 'Name must contain at least one letter or digit',
      });
    } else {
      validated.slug = slug;
    }
  }

  // brand — required, findMany ambiguity pattern (D-04)
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

  // sort_order — optional, integer >= 0, default 0
  const sortOrderRaw = (raw.sort_order ?? '').trim();
  if (sortOrderRaw) {
    const val = sanitizeNumber(sortOrderRaw);
    if (val === null || val < 0 || Math.floor(val) !== val) {
      errors.push({
        field: 'sort_order',
        message: 'Must be an integer >= 0',
      });
    } else {
      validated.sort_order = val;
    }
  } else {
    validated.sort_order = 0;
  }

  // Duplicate detection: search by name only, then compare brand
  let existingId: string | undefined;
  let status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  if (errors.length === 0 && validated.brand_id && validated.name) {
    const existing = await prisma.productCategory.findFirst({
      where: {
        name: { equals: validated.name as string, mode: 'insensitive' },
      },
      select: { id: true, brand_id: true },
    });
    if (existing) {
      existingId = existing.id;
      // D-02 blocked check: if brand_id differs from existing, block
      if (existing.brand_id !== (validated.brand_id as string)) {
        errors.push({
          field: 'brand',
          message: 'Cannot move category to a different brand',
        });
        status = 'blocked';
      } else {
        status = 'duplicate';
      }
    }
  }

  // `ProductCategory.slug` is unique per node. Catching a collision here turns
  // what would otherwise roll back the whole import into one cell error.
  if (errors.length === 0 && validated.slug) {
    const slugOwner = await prisma.productCategory.findFirst({
      where: { slug: validated.slug as string },
      select: { id: true, name: true },
    });
    if (slugOwner && slugOwner.id !== existingId) {
      errors.push({
        field: 'name',
        message: `Slug '${validated.slug as string}' is already used by '${slugOwner.name}'`,
      });
      status = 'invalid';
    }
  }

  return { rowIndex, raw, validated, errors, status, existingId };
}
