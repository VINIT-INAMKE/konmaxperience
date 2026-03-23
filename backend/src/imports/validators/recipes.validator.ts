import { PrismaService } from '../../prisma/prisma.service';
import type { CellError, ImportRow } from '../import-types';
import { sanitizeNumber } from '../import-types';

const VALID_INPUT_TYPES = ['ingredient', 'recipe'];

export async function validateRecipeHeaderRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // name — required, min 3 chars
  const name = (raw.name ?? '').trim();
  if (!name || name.length < 3) {
    errors.push({ field: 'name', message: 'Required (min 3 chars)' });
  } else {
    validated.name = name;
  }

  // description — required
  const description = (raw.description ?? '').trim();
  if (!description) {
    errors.push({ field: 'description', message: 'Required' });
  } else {
    validated.description = description;
  }

  // prep_steps — required
  const prepSteps = (raw.prep_steps ?? '').trim();
  if (!prepSteps) {
    errors.push({ field: 'prep_steps', message: 'Required' });
  } else {
    validated.prep_steps = prepSteps;
  }

  // cooking_method — required
  const cookingMethod = (raw.cooking_method ?? '').trim();
  if (!cookingMethod) {
    errors.push({ field: 'cooking_method', message: 'Required' });
  } else {
    validated.cooking_method = cookingMethod;
  }

  // yield_qty — required, > 0
  const yieldQtyRaw = (raw.yield_qty ?? '').trim();
  if (!yieldQtyRaw) {
    errors.push({ field: 'yield_qty', message: 'Required' });
  } else {
    const val = sanitizeNumber(yieldQtyRaw);
    if (val === null || val <= 0) {
      errors.push({
        field: 'yield_qty',
        message: 'Must be a number > 0',
      });
    } else {
      validated.yield_qty = val;
    }
  }

  // yield_unit — required
  const yieldUnit = (raw.yield_unit ?? '').trim();
  if (!yieldUnit) {
    errors.push({ field: 'yield_unit', message: 'Required' });
  } else {
    validated.yield_unit = yieldUnit;
  }

  // portion_size — required
  const portionSize = (raw.portion_size ?? '').trim();
  if (!portionSize) {
    errors.push({ field: 'portion_size', message: 'Required' });
  } else {
    validated.portion_size = portionSize;
  }

  // shelf_life_hours — optional, integer >= 1
  const shelfLifeRaw = (raw.shelf_life_hours ?? '').trim();
  if (shelfLifeRaw) {
    const val = sanitizeNumber(shelfLifeRaw);
    if (val === null || val < 1 || Math.floor(val) !== val) {
      errors.push({
        field: 'shelf_life_hours',
        message: 'Must be an integer >= 1',
      });
    } else {
      validated.shelf_life_hours = val;
    }
  }

  // brand — optional, findMany ambiguity pattern (D-04)
  const brandName = (raw.brand ?? '').trim();
  if (brandName) {
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

  // zone — optional, findMany ambiguity pattern (D-04)
  const zoneName = (raw.zone ?? '').trim();
  if (zoneName) {
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

  // Duplicate detection: by name
  let existingId: string | undefined;
  let status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  if (errors.length === 0 && validated.name) {
    const existing = await prisma.recipe.findFirst({
      where: {
        name: { equals: validated.name as string, mode: 'insensitive' },
      },
      select: { id: true, status: true },
    });
    if (existing) {
      existingId = existing.id;
      if (existing.status === 'approved') {
        errors.push({
          field: 'name',
          message:
            'Cannot modify approved recipe — archive it first or create a new version',
        });
        status = 'blocked';
      } else {
        // draft status — allow update
        status = 'duplicate';
      }
    }
  }

  return { rowIndex, raw, validated, errors, status, existingId };
}

export async function validateRecipeBomRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
  recipeNameMap?: Map<string, string>,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // recipe_name — required, must exist in recipeNameMap or DB
  const recipeName = (raw.recipe_name ?? '').trim();
  if (!recipeName) {
    errors.push({ field: 'recipe_name', message: 'Required' });
  } else {
    const lowerName = recipeName.toLowerCase();
    const inMap = recipeNameMap?.has(lowerName);
    if (!inMap) {
      const dbRecipe = await prisma.recipe.findFirst({
        where: { name: { equals: recipeName, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!dbRecipe) {
        errors.push({
          field: 'recipe_name',
          message: `Recipe '${recipeName}' not found in Sheet 1 or database`,
        });
      } else {
        validated.recipe_name = recipeName;
        validated.recipe_id = dbRecipe.id;
      }
    } else {
      validated.recipe_name = recipeName;
    }
  }

  // input_type — required, enum
  const inputType = (raw.input_type ?? '').trim().toLowerCase();
  if (!inputType) {
    errors.push({ field: 'input_type', message: 'Required' });
  } else if (!VALID_INPUT_TYPES.includes(inputType)) {
    errors.push({
      field: 'input_type',
      message: `Invalid input_type '${inputType}'. Valid values: ingredient, recipe`,
    });
  } else {
    validated.input_type = inputType;
  }

  // ingredient_name — required, resolution depends on input_type
  const ingredientName = (raw.ingredient_name ?? '').trim();
  if (!ingredientName) {
    errors.push({ field: 'ingredient_name', message: 'Required' });
  } else if (validated.input_type === 'ingredient') {
    const ingredient = await prisma.ingredient.findFirst({
      where: { name: { equals: ingredientName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!ingredient) {
      errors.push({
        field: 'ingredient_name',
        message: `Ingredient '${ingredientName}' not found`,
      });
    } else {
      validated.ingredient_id = ingredient.id;
    }
  } else if (validated.input_type === 'recipe') {
    // D-19: Cycle check — self-reference
    const parentName = recipeName.toLowerCase();
    const subName = ingredientName.toLowerCase();
    if (parentName && subName === parentName) {
      errors.push({
        field: 'ingredient_name',
        message:
          'Circular reference — recipe cannot use itself as ingredient',
      });
    } else {
      // Check in recipeNameMap or DB
      const inMap = recipeNameMap?.has(subName);
      if (!inMap) {
        const dbRecipe = await prisma.recipe.findFirst({
          where: { name: { equals: ingredientName, mode: 'insensitive' } },
          select: { id: true },
        });
        if (!dbRecipe) {
          errors.push({
            field: 'ingredient_name',
            message: `Sub-recipe '${ingredientName}' not found`,
          });
        } else {
          validated.source_recipe_id = dbRecipe.id;
        }
      } else {
        // Exists in current import — will be resolved at commit time
        validated.source_recipe_name = ingredientName;
      }
    }
  }

  // quantity — required, > 0
  const quantityRaw = (raw.quantity ?? '').trim();
  if (!quantityRaw) {
    errors.push({ field: 'quantity', message: 'Required' });
  } else {
    const val = sanitizeNumber(quantityRaw);
    if (val === null || val <= 0) {
      errors.push({
        field: 'quantity',
        message: 'Must be a number > 0',
      });
    } else {
      validated.quantity = val;
    }
  }

  // unit — required
  const unit = (raw.unit ?? '').trim();
  if (!unit) {
    errors.push({ field: 'unit', message: 'Required' });
  } else {
    validated.unit = unit;
  }

  // prep_notes — optional
  const prepNotes = (raw.prep_notes ?? '').trim();
  if (prepNotes) {
    validated.prep_notes = prepNotes;
  }

  const status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';

  return { rowIndex, raw, validated, errors, status };
}
