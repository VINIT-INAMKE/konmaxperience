import { ProductStatus, ProductType, RecipeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CellError, ImportRow } from '../import-types';
import { sanitizeNumber, slugify } from '../import-types';

/** Product types that must be backed by an approved recipe (mirrors CatalogService.assertRecipeUsable). */
const RECIPE_BACKED_TYPES: ProductType[] = [
  ProductType.prepared_food,
  ProductType.packaged,
];

export async function validateProductRow(
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

  // slug — optional; derived from name when the column is blank.
  // `Product.slug` is required and unique per node.
  const slug = slugify((raw.slug ?? '').trim() || name);
  if (!slug) {
    if (name) {
      errors.push({
        field: 'slug',
        message: 'Could not derive a slug — provide a slug column',
      });
    }
  } else {
    validated.slug = slug;
  }

  // type — required ProductType
  const typeRaw = (raw.type ?? '').trim().toLowerCase();
  let productType: ProductType | null = null;
  if (!typeRaw) {
    errors.push({ field: 'type', message: 'Required' });
  } else if (!Object.values(ProductType).includes(typeRaw as ProductType)) {
    errors.push({
      field: 'type',
      message: `Invalid value. Accepted values: ${Object.values(ProductType).join(', ')}`,
    });
  } else {
    productType = typeRaw as ProductType;
    validated.type = productType;
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

  // recipe — required for recipe-backed types, must be approved
  const recipeName = (raw.recipe ?? '').trim();
  const recipeRequired =
    productType !== null && RECIPE_BACKED_TYPES.includes(productType);
  if (!recipeName) {
    if (recipeRequired) {
      errors.push({
        field: 'recipe',
        message: `Required for ${productType} products`,
      });
    }
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
    } else if (recipe.status !== RecipeStatus.approved) {
      errors.push({
        field: 'recipe',
        message: `Recipe '${recipeName}' is not approved — only approved recipes can be linked to products`,
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
    const category = await prisma.productCategory.findFirst({
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

  // status — optional ProductStatus, default draft (imports do not auto-publish)
  const statusRaw = (raw.status ?? '').trim().toLowerCase();
  if (statusRaw) {
    if (!Object.values(ProductStatus).includes(statusRaw as ProductStatus)) {
      errors.push({
        field: 'status',
        message: `Invalid value. Accepted values: ${Object.values(ProductStatus).join(', ')}`,
      });
    } else {
      validated.status = statusRaw as ProductStatus;
    }
  } else {
    validated.status = ProductStatus.draft;
  }

  // Duplicate detection: name + category_id
  let existingId: string | undefined;
  let status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  if (errors.length === 0 && validated.category_id && validated.name) {
    const existing = await prisma.product.findFirst({
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

  // `Product.slug` is unique per node. Catching a collision here turns what would
  // otherwise roll back the whole import into one cell error on this row.
  if (errors.length === 0 && validated.slug) {
    const slugOwner = await prisma.product.findFirst({
      where: { slug: validated.slug as string },
      select: { id: true, name: true },
    });
    if (slugOwner && slugOwner.id !== existingId) {
      errors.push({
        field: 'slug',
        message: `Slug '${validated.slug as string}' is already used by '${slugOwner.name}'`,
      });
      status = 'invalid';
    }
  }

  return { rowIndex, raw, validated, errors, status, existingId };
}
