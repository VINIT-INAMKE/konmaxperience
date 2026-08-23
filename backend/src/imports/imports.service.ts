import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { ProductStatus, ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CostCalculatorService } from '../recipes/cost-calculator.service';
import { parseCSV } from './parsers/csv.parser';
import { parseXLSX } from './parsers/xlsx.parser';
import { parseRecipeXLSX } from './parsers/recipe-xlsx.parser';
import { validateIngredientRow } from './validators/ingredients.validator';
import { validateVendorRow } from './validators/vendors.validator';
import { validateVendorPricingRow } from './validators/vendor-pricing.validator';
import { validateOpeningStockRow } from './validators/opening-stock.validator';
import { validateMissionRow } from './validators/missions.validator';
import { validateQuestRow } from './validators/quests.validator';
import { validateTaskRow } from './validators/tasks.validator';
import { validateKpiRow } from './validators/kpis.validator';
import { validateEventRow } from './validators/events.validator';
import {
  validateRecipeHeaderRow,
  validateRecipeBomRow,
} from './validators/recipes.validator';
import { validateProductCategoryRow } from './validators/product-categories.validator';
import { validateProductRow } from './validators/products.validator';
import { validatePurchaseOrderRow } from './validators/purchase-orders.validator';
import {
  IMPORT_TYPE_CONFIG,
  type ImportType,
  type ImportRow,
  type ParseResult,
  type RecipeParseResult,
  type CommitResult,
} from './import-types';

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly costCalculatorService: CostCalculatorService,
  ) {}

  async parseFile(
    buffer: Buffer,
    mimetype: string,
    importType: ImportType,
  ): Promise<ParseResult | RecipeParseResult> {
    // D-13: Recipes use multi-sheet XLSX parser
    if (importType === 'recipes') {
      return this.parseRecipeFile(buffer, importType);
    }

    // Parse raw rows from file
    // M7: Reject legacy .xls format — only allow CSV and XLSX
    if (mimetype === 'application/vnd.ms-excel') {
      throw new BadRequestException(
        'Legacy .xls format is not supported. Please save as .xlsx or .csv',
      );
    }

    const rawRows =
      mimetype === 'text/csv'
        ? await parseCSV(buffer)
        : await parseXLSX(buffer);

    if (rawRows.length === 0) {
      throw new BadRequestException('File contains no data rows');
    }

    // D-30: Enforce 500-row limit
    if (rawRows.length > 500) {
      throw new BadRequestException(
        'This file exceeds the 500-row limit. Split it into smaller files and import each separately.',
      );
    }

    // Normalize headers to lowercase
    const normalizedRows = rawRows.map((row) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[key.trim().toLowerCase()] = value;
      }
      return normalized;
    });

    // Validate each row against the import type's schema
    const validatedRows: ImportRow[] = [];
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      const validated = await this.validateRow(
        row,
        i + 2, // +2: 1-based + header row
        importType,
      );
      validatedRows.push(validated);
    }

    const config = IMPORT_TYPE_CONFIG[importType];

    // D-09, D-22, D-32: Stock re-import detection via SHA-256
    let warning: string | undefined;
    let fileHash: string | undefined;
    if (importType === 'opening_stock') {
      fileHash = createHash('sha256').update(buffer).digest('hex');
      const existingImport = await this.prisma.stockMovement.findFirst({
        where: { reference_type: 'import', reference_id: fileHash },
        select: { created_at: true },
      });
      if (existingImport) {
        warning = `This file was already imported on ${existingImport.created_at.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}. Re-importing will create duplicate stock movements.`;
      }
      // Pass fileHash through first row for commitStockImport (D-22)
      if (validatedRows.length > 0) {
        validatedRows[0].validated.fileHash = fileHash;
      }
    }

    return {
      importType,
      rows: validatedRows,
      totalRows: validatedRows.length,
      validCount: validatedRows.filter((r) => r.status === 'valid').length,
      invalidCount: validatedRows.filter((r) => r.status === 'invalid').length,
      duplicateCount: validatedRows.filter((r) => r.status === 'duplicate')
        .length,
      blockedCount: validatedRows.filter((r) => r.status === 'blocked').length,
      columns: config.columns,
      warning,
    };
  }

  private async parseRecipeFile(
    buffer: Buffer,
    importType: ImportType,
  ): Promise<RecipeParseResult> {
    const { headers: rawHeaders, bomLines: rawBomLines } =
      await parseRecipeXLSX(buffer);

    if (rawHeaders.length === 0) {
      throw new BadRequestException('Recipe sheet contains no data rows');
    }

    // D-30: Enforce 500-row limit on both sheets combined
    if (rawHeaders.length + rawBomLines.length > 500) {
      throw new BadRequestException(
        'This file exceeds the 500-row limit. Split it into smaller files and import each separately.',
      );
    }

    // Normalize headers
    const normalizeRow = (row: Record<string, string>) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[key.trim().toLowerCase()] = value;
      }
      return normalized;
    };

    const normalizedHeaders = rawHeaders.map(normalizeRow);
    const normalizedBomLines = rawBomLines.map(normalizeRow);

    // Build recipe name map for BOM validation (names from Sheet 1)
    const recipeNameMap = new Map<string, string>();
    for (const row of normalizedHeaders) {
      const name = (row.name ?? '').trim().toLowerCase();
      if (name) recipeNameMap.set(name, 'pending');
    }

    // Validate recipe header rows
    const validatedHeaders: ImportRow[] = [];
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const row = normalizedHeaders[i];
      const validated = await validateRecipeHeaderRow(
        row,
        i + 2,
        this.prisma,
      );
      validatedHeaders.push(validated);
    }

    // Validate BOM lines with recipe name map for cross-sheet references
    const validatedBom: ImportRow[] = [];
    for (let i = 0; i < normalizedBomLines.length; i++) {
      const validated = await validateRecipeBomRow(
        normalizedBomLines[i],
        i + 2,
        this.prisma,
        recipeNameMap,
      );
      validatedBom.push(validated);
    }

    // D-15: If recipe header is invalid/blocked, mark all its BOM lines too
    const invalidRecipeNames = new Set<string>();
    for (const row of validatedHeaders) {
      if (row.status === 'invalid' || row.status === 'blocked') {
        const name = ((row.raw.name ?? '') as string).trim().toLowerCase();
        if (name) invalidRecipeNames.add(name);
      }
    }
    for (const bomRow of validatedBom) {
      const recipeName = ((bomRow.raw.recipe_name ?? '') as string)
        .trim()
        .toLowerCase();
      if (invalidRecipeNames.has(recipeName) && bomRow.status !== 'invalid') {
        bomRow.status = 'invalid';
        bomRow.errors.push({
          field: 'recipe_name',
          message: 'Parent recipe is invalid or blocked',
        });
      }
    }

    const config = IMPORT_TYPE_CONFIG[importType];
    const bomColumns = [
      'recipe_name',
      'input_type',
      'ingredient_name',
      'quantity',
      'unit',
      'prep_notes',
    ];

    return {
      importType,
      rows: validatedHeaders,
      totalRows: validatedHeaders.length,
      validCount: validatedHeaders.filter((r) => r.status === 'valid').length,
      invalidCount: validatedHeaders.filter((r) => r.status === 'invalid')
        .length,
      duplicateCount: validatedHeaders.filter((r) => r.status === 'duplicate')
        .length,
      blockedCount: validatedHeaders.filter((r) => r.status === 'blocked')
        .length,
      columns: config.columns,
      bomRows: validatedBom,
      bomColumns,
      bomValidCount: validatedBom.filter((r) => r.status === 'valid').length,
      bomInvalidCount: validatedBom.filter((r) => r.status === 'invalid')
        .length,
    };
  }

  private async validateRow(
    raw: Record<string, string>,
    rowIndex: number,
    importType: ImportType,
  ): Promise<ImportRow> {
    switch (importType) {
      case 'ingredients':
        return validateIngredientRow(raw, rowIndex, this.prisma);
      case 'vendors':
        return validateVendorRow(raw, rowIndex, this.prisma);
      case 'vendor_pricing':
        return validateVendorPricingRow(raw, rowIndex, this.prisma);
      case 'opening_stock':
        return validateOpeningStockRow(raw, rowIndex, this.prisma);
      case 'missions':
        return validateMissionRow(raw, rowIndex, this.prisma);
      case 'quests':
        return validateQuestRow(raw, rowIndex, this.prisma);
      case 'tasks':
        return validateTaskRow(raw, rowIndex, this.prisma);
      case 'kpis':
        return validateKpiRow(raw, rowIndex, this.prisma);
      case 'events':
        return validateEventRow(raw, rowIndex, this.prisma);
      case 'recipes':
        // Recipe headers are validated via parseRecipeFile, not here
        return validateRecipeHeaderRow(raw, rowIndex, this.prisma);
      case 'product_categories':
        return validateProductCategoryRow(raw, rowIndex, this.prisma);
      case 'products':
        return validateProductRow(raw, rowIndex, this.prisma);
      case 'purchase_orders':
        return validatePurchaseOrderRow(raw, rowIndex, this.prisma);
      default:
        return {
          rowIndex,
          raw,
          validated: { ...raw },
          errors: [],
          status: 'valid',
        };
    }
  }

  async commitImport(
    importType: ImportType,
    rows: ImportRow[],
    updateExisting: boolean,
    userId: string,
    bomRows?: ImportRow[],
  ): Promise<CommitResult> {
    // Stock has its own commit path — no outer transaction (D-08)
    if (importType === 'opening_stock') {
      const fileHash = (rows[0]?.validated?.fileHash as string) || '';
      return this.commitStockImport(rows, userId, fileHash);
    }

    // Recipe has its own two-pass commit path (D-03, D-07)
    if (importType === 'recipes') {
      return this.commitRecipeImport(rows, bomRows || [], updateExisting, userId);
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const transactionErrors: Array<{ rowIndex: number; message: string }> = [];

    // Filter to committable rows: valid + (duplicates if updateExisting)
    const committable = rows.filter((r) => {
      if (r.status === 'valid') return true;
      if (r.status === 'duplicate' && updateExisting) return true;
      if (r.status === 'duplicate' && !updateExisting) {
        skipped++;
        return false;
      }
      return false; // invalid and blocked rows
    });

    // Use Prisma transaction for atomicity per research recommendation
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const row of committable) {
          try {
            if (
              row.status === 'duplicate' &&
              updateExisting &&
              row.existingId
            ) {
              await this.updateRow(tx, importType, row, userId);
              updated++;
            } else {
              await this.createRow(tx, importType, row, userId);
              imported++;
            }
          } catch (err) {
            transactionErrors.push({
              rowIndex: row.rowIndex,
              message:
                err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }

        // D-26 FIX: Re-throw collected errors for full rollback
        if (transactionErrors.length > 0) {
          throw new Error(
            `${transactionErrors.length} row(s) failed: ${transactionErrors.map((e) => `Row ${e.rowIndex}: ${e.message}`).join('; ')}`,
          );
        }
      });
    } catch (err) {
      this.logger.error('Import transaction failed', err);
      // Transaction rolled back — imported and updated counts are 0
      return {
        imported: 0,
        updated: 0,
        skipped,
        errors: transactionErrors.length,
        errorDetails: transactionErrors,
      };
    }

    // After successful vendor_pricing import, trigger cost recalculation for affected recipes
    if (importType === 'vendor_pricing' && (imported > 0 || updated > 0)) {
      const ingredientIds = new Set<string>();
      for (const row of committable) {
        const ingId = row.validated.ingredient_id as string;
        if (ingId) ingredientIds.add(ingId);
      }
      // Fire-and-forget — cost recalculation is non-blocking
      for (const ingId of ingredientIds) {
        this.costCalculatorService
          .recalculateForIngredient(ingId)
          .catch((err) =>
            this.logger.warn(`Cost recalc failed for ingredient ${ingId}`, err),
          );
      }
    }

    return {
      imported,
      updated,
      skipped,
      errors: 0,
      errorDetails: [],
    };
  }

  async getPrerequisites() {
    const [
      ingredients,
      vendors,
      zones,
      brands,
      missions,
      quests,
      approvedRecipes,
      productCategories,
    ] = await Promise.all([
      this.prisma.ingredient.count(),
      this.prisma.vendor.count(),
      this.prisma.zone.count(),
      this.prisma.brand.count(),
      this.prisma.mission.count(),
      this.prisma.quest.count(),
      this.prisma.recipe.count({ where: { status: 'approved' } }),
      this.prisma.productCategory.count(),
    ]);
    return {
      ingredients,
      vendors,
      zones,
      brands,
      missions,
      quests,
      approved_recipes: approvedRecipes,
      product_categories: productCategories,
    };
  }

  /**
   * Stock import commit path — NO outer transaction (D-08).
   * Each inventoryService.adjust() is independently atomic.
   * Tags StockMovement with reference_type='import' for re-import detection (D-22).
   */
  private async commitStockImport(
    rows: ImportRow[],
    userId: string,
    fileHash: string,
  ): Promise<CommitResult> {
    const committable = rows.filter((r) => r.status === 'valid');
    // H3: Calculate skipped as total minus committable
    const skipped = rows.length - committable.length;
    let imported = 0;
    const errorDetails: Array<{ rowIndex: number; message: string }> = [];

    for (const row of committable) {
      try {
        // H4: Pass referenceType/referenceId directly to adjust() — eliminates race condition
        await this.inventoryService.adjust(
          {
            ingredient_id: row.validated.ingredient_id as string,
            zone_id: row.validated.zone_id as string,
            quantity: row.validated.quantity as number,
            unit: row.validated.unit as string,
            reason: (row.validated.reason as string) || 'Opening stock',
          },
          userId,
          'import',
          fileHash,
        );
        imported++;
      } catch (err) {
        errorDetails.push({
          rowIndex: row.rowIndex,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return {
      imported,
      updated: 0,
      skipped,
      errors: errorDetails.length,
      errorDetails,
    };
  }

  /**
   * Recipe two-pass commit (D-03, D-07, D-15, D-17).
   * Pass 1: Create/update recipe headers, build recipeIdMap.
   * Pass 2: Delete old BOM + create new BOM lines.
   * Cost calculation runs OUTSIDE transaction (non-critical).
   */
  private async commitRecipeImport(
    headerRows: ImportRow[],
    bomRows: ImportRow[],
    updateExisting: boolean,
    userId: string,
  ): Promise<CommitResult> {
    const committableHeaders = headerRows.filter((r) => {
      if (r.status === 'valid') return true;
      if (r.status === 'duplicate' && updateExisting) return true;
      return false;
    });

    let imported = 0;
    let updated = 0;
    const skipped = headerRows.length - committableHeaders.length;
    const transactionErrors: Array<{ rowIndex: number; message: string }> = [];

    // Group BOM rows by recipe_name (lowercase)
    const bomByRecipe = new Map<string, ImportRow[]>();
    for (const bom of (bomRows || []).filter(
      (r) => r.status === 'valid' || r.status === 'duplicate',
    )) {
      const name = ((bom.raw.recipe_name || '') as string).trim().toLowerCase();
      if (!bomByRecipe.has(name)) bomByRecipe.set(name, []);
      bomByRecipe.get(name)!.push(bom);
    }

    const recipeIdsForCostCalc: string[] = [];

    try {
      await this.prisma.$transaction(async (tx) => {
        const recipeIdMap = new Map<string, string>(); // lowercase name -> recipe ID

        // PASS 1: Create/update recipe headers
        for (const row of committableHeaders) {
          try {
            const v = row.validated;
            const recipeName = ((v.name as string) || '').toLowerCase();

            if (
              row.status === 'duplicate' &&
              updateExisting &&
              row.existingId
            ) {
              // D-03: Update all header fields for draft recipes (validator already blocked approved)
              await tx.recipe.update({
                where: { id: row.existingId },
                data: {
                  name: v.name as string,
                  description: v.description as string,
                  prep_steps: v.prep_steps as string,
                  cooking_method: v.cooking_method as string,
                  yield_qty: v.yield_qty as number,
                  yield_unit: v.yield_unit as string,
                  portion_size: v.portion_size as string,
                  shelf_life_hours: v.shelf_life_hours
                    ? (v.shelf_life_hours as number)
                    : undefined,
                  brand_id: v.brand_id ? (v.brand_id as string) : undefined,
                  zone_id: v.zone_id ? (v.zone_id as string) : undefined,
                  // NEVER: computed_cost, status
                },
              });
              recipeIdMap.set(recipeName, row.existingId);
              recipeIdsForCostCalc.push(row.existingId);
              updated++;
            } else {
              const recipe = await tx.recipe.create({
                data: {
                  name: v.name as string,
                  description: v.description as string,
                  prep_steps: v.prep_steps as string,
                  cooking_method: v.cooking_method as string,
                  yield_qty: v.yield_qty as number,
                  yield_unit: v.yield_unit as string,
                  portion_size: v.portion_size as string,
                  shelf_life_hours: v.shelf_life_hours
                    ? (v.shelf_life_hours as number)
                    : undefined,
                  brand_id: v.brand_id ? (v.brand_id as string) : undefined,
                  zone_id: v.zone_id ? (v.zone_id as string) : undefined,
                  status: 'draft',
                  created_by: userId,
                },
              });
              recipeIdMap.set(recipeName, recipe.id);
              recipeIdsForCostCalc.push(recipe.id);
              imported++;
            }
          } catch (err) {
            transactionErrors.push({
              rowIndex: row.rowIndex,
              message: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }

        // PASS 2: Delete old BOM lines (for updates) + create new BOM lines
        for (const [recipeName, bomLines] of bomByRecipe) {
          const recipeId = recipeIdMap.get(recipeName);
          if (!recipeId) continue; // Recipe not committed (was invalid/skipped)

          try {
            // D-03: Delete existing BOM lines for updated recipes
            await tx.recipeLine.deleteMany({
              where: { recipe_id: recipeId },
            });

            // Create new BOM lines with sort_order
            for (let i = 0; i < bomLines.length; i++) {
              const bv = bomLines[i].validated;
              const inputType = bv.input_type as string;

              // D-19: Cycle detection for sub-recipe references — recursive BFS (M1 fix)
              // Also check same-file sub-recipes resolved via recipeIdMap (NEW-3 fix)
              const resolvedSourceId = (bv.source_recipe_id as string | undefined)
                || (inputType === 'recipe' && bv.source_recipe_name
                  ? recipeIdMap.get((bv.source_recipe_name as string).toLowerCase())
                  : undefined);
              if (inputType === 'recipe' && resolvedSourceId) {
                const sourceId = resolvedSourceId;
                // Check if source_recipe_id points back to this recipe
                if (sourceId === recipeId) {
                  throw new Error(
                    `BOM line ${i + 1}: Circular reference — recipe cannot use itself`,
                  );
                }
                // Walk full BOM tree to detect deeper cycles (max depth 10)
                const visited = new Set<string>();
                const queue: string[] = [sourceId];
                let depth = 0;
                while (queue.length > 0 && depth < 10) {
                  const batch = [...queue];
                  queue.length = 0;
                  for (const checkId of batch) {
                    if (visited.has(checkId)) continue;
                    visited.add(checkId);
                    if (checkId === recipeId) {
                      throw new Error(
                        `BOM line ${i + 1}: Circular reference detected — sub-recipe chain leads back to this recipe`,
                      );
                    }
                    const childLines = await tx.recipeLine.findMany({
                      where: {
                        recipe_id: checkId,
                        input_type: 'recipe',
                      },
                      select: { source_recipe_id: true },
                    });
                    for (const cl of childLines) {
                      if (cl.source_recipe_id && !visited.has(cl.source_recipe_id)) {
                        queue.push(cl.source_recipe_id);
                      }
                    }
                  }
                  depth++;
                }
              }

              // C1 fix: Resolve source_recipe_id for sub-recipes referencing recipes in the same file
              // The validator stores the sub-recipe name in bv.source_recipe_name (not bv.ingredient_name)
              let finalSourceRecipeId = bv.source_recipe_id as
                | string
                | undefined;
              if (inputType === 'recipe' && !finalSourceRecipeId) {
                // Sub-recipe name might map to a recipe in the same import
                const subRecipeName = (
                  (bv.source_recipe_name as string) || ''
                ).toLowerCase();
                finalSourceRecipeId = recipeIdMap.get(subRecipeName);
                if (!finalSourceRecipeId) {
                  throw new Error(
                    `BOM line ${i + 1}: Sub-recipe '${bv.source_recipe_name}' not found`,
                  );
                }
              }

              await tx.recipeLine.create({
                data: {
                  recipe_id: recipeId,
                  input_type: inputType,
                  ingredient_id:
                    inputType === 'ingredient'
                      ? (bv.ingredient_id as string)
                      : undefined,
                  source_recipe_id:
                    inputType === 'recipe'
                      ? finalSourceRecipeId ||
                        (bv.source_recipe_id as string)
                      : undefined,
                  quantity: bv.quantity as number,
                  unit: bv.unit as string,
                  prep_notes: bv.prep_notes
                    ? (bv.prep_notes as string)
                    : undefined,
                  sort_order: i,
                },
              });
            }
          } catch (err) {
            transactionErrors.push({
              rowIndex: bomLines[0]?.rowIndex || 0,
              message: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }

        // D-26: Re-throw for full rollback if any errors
        if (transactionErrors.length > 0) {
          throw new Error(
            `${transactionErrors.length} error(s): ${transactionErrors.map((e) => `Row ${e.rowIndex}: ${e.message}`).join('; ')}`,
          );
        }
      });
    } catch (err) {
      return {
        imported: 0,
        updated: 0,
        skipped,
        errors: transactionErrors.length || 1,
        errorDetails:
          transactionErrors.length > 0
            ? transactionErrors
            : [
                {
                  rowIndex: 0,
                  message:
                    err instanceof Error ? err.message : 'Unknown error',
                },
              ],
      };
    }

    // D-07: Cost calculation runs OUTSIDE transaction (non-critical, retryable)
    for (const recipeId of recipeIdsForCostCalc) {
      try {
        await this.costCalculatorService.recalculateAndSave(recipeId);
      } catch (err) {
        this.logger.warn(
          `Cost recalculation failed for recipe ${recipeId}`,
          err,
        );
        // Non-fatal — recipe is still saved
      }
    }

    return { imported, updated, skipped, errors: 0, errorDetails: [] };
  }

  private async createRow(
    tx: any,
    importType: ImportType,
    row: ImportRow,
    userId: string,
  ): Promise<void> {
    const v = row.validated;
    switch (importType) {
      case 'ingredients':
        await tx.ingredient.create({
          data: {
            name: v.name as string,
            category_id: v.category_id as string,
            base_unit: v.base_unit as string,
            min_stock_level: v.min_stock_level as number,
          },
        });
        break;
      case 'vendors':
        await tx.vendor.create({
          data: {
            name: v.name as string,
            phone: v.phone as string | undefined,
            email: v.email as string | undefined,
            address: v.address as string | undefined,
            payment_terms: v.payment_terms as string | undefined,
            status: (v.status as string) || 'active',
          },
        });
        break;
      case 'vendor_pricing':
        await tx.vendorPrice.create({
          data: {
            vendor_id: v.vendor_id as string,
            ingredient_id: v.ingredient_id as string,
            price: v.price as number,
            unit: v.unit as string,
            effective_date: v.effective_date as Date,
          },
        });
        break;
      case 'missions':
        await tx.mission.create({
          data: {
            title: v.title as string,
            description: v.description as string,
            phase: v.phase as string,
            scope: v.scope as string,
            start_date: v.start_date ? (v.start_date as Date) : undefined,
            end_date: v.end_date ? (v.end_date as Date) : undefined,
            created_by: userId,
          },
        });
        break;
      case 'quests':
        await tx.quest.create({
          data: {
            title: v.title as string,
            description: v.description as string,
            mission_id: v.mission_id as string,
            week_number: v.week_number as number,
            owner_user_id: v.owner_user_id as string,
            start_date: v.start_date ? (v.start_date as Date) : undefined,
            end_date: v.end_date ? (v.end_date as Date) : undefined,
          },
        });
        break;
      case 'tasks':
        await tx.task.create({
          data: {
            title: v.title as string,
            description: v.description as string,
            mission_id: v.mission_id as string,
            quest_id: v.quest_id ? (v.quest_id as string) : undefined,
            task_type: v.task_type as string,
            domain: v.domain as string,
            owner_user_id: v.owner_user_id as string,
            created_by: userId,
            priority: v.priority as string,
            xp: (v.xp as number) ?? 25,
            due_date: v.due_date ? (v.due_date as Date) : undefined,
            readiness_meter_id: v.readiness_meter_id
              ? (v.readiness_meter_id as string)
              : undefined,
            kpi_id: v.kpi_id ? (v.kpi_id as string) : undefined,
            depends_on_task_id: v.depends_on_task_id
              ? (v.depends_on_task_id as string)
              : undefined,
            requires_approval: (v.requires_approval as boolean) ?? true,
          },
        });
        break;
      case 'kpis':
        await tx.kpi.create({
          data: {
            name: v.name as string,
            description: v.description as string,
            unit: v.unit as string,
            target_value: v.target_value as number,
            domain: v.domain as string,
            current_value: (v.current_value as number) ?? 0,
            status: (v.status as string) ?? 'on_track',
          },
        });
        break;
      case 'events':
        await tx.event.create({
          data: {
            title: v.title as string,
            event_type: v.event_type as string,
            date: v.date as Date,
            capacity: v.capacity as number,
            price: v.price as number,
            zone_id: v.zone_id ? (v.zone_id as string) : undefined,
            brand_id: v.brand_id ? (v.brand_id as string) : undefined,
            description: v.description ? (v.description as string) : undefined,
          },
        });
        break;
      case 'product_categories':
        await tx.productCategory.create({
          data: {
            name: v.name as string,
            slug: v.slug as string,
            brand_id: v.brand_id as string,
            sort_order: (v.sort_order as number) ?? 0,
          },
        });
        break;
      case 'products':
        await tx.product.create({
          data: {
            name: v.name as string,
            slug: v.slug as string,
            type: v.type as ProductType,
            brand_id: v.brand_id as string,
            category_id: v.category_id as string,
            recipe_id: v.recipe_id ? (v.recipe_id as string) : undefined,
            base_price: v.base_price as number,
            status: (v.status as ProductStatus) ?? ProductStatus.draft,
            created_by: userId,
            updated_by: userId,
          },
        });
        break;
      case 'purchase_orders':
        await tx.purchaseOrder.create({
          data: {
            vendor_id: v.vendor_id as string,
            zone_id: v.zone_id as string,
            status: (v.status as string) || 'draft',
            notes: v.notes ? (v.notes as string) : undefined,
            linked_task_id: v.linked_task_id
              ? (v.linked_task_id as string)
              : undefined,
            ordered_by: userId,
            total_amount: 0,
          },
        });
        break;
      // opening_stock and recipes use their own commit paths — not handled here
    }
  }

  private async updateRow(
    tx: any,
    importType: ImportType,
    row: ImportRow,
    userId: string,
  ): Promise<void> {
    const v = row.validated;
    const id = row.existingId!;
    switch (importType) {
      case 'ingredients':
        await tx.ingredient.update({
          where: { id },
          data: {
            name: v.name as string,
            category_id: v.category_id as string,
            // base_unit intentionally NOT updated — D-28 defense-in-depth
            min_stock_level: v.min_stock_level as number,
          },
        });
        break;
      case 'vendors':
        await tx.vendor.update({
          where: { id },
          data: {
            name: v.name as string,
            phone: v.phone as string | undefined,
            email: v.email as string | undefined,
            address: v.address as string | undefined,
            payment_terms: v.payment_terms as string | undefined,
            status: (v.status as string) || 'active',
          },
        });
        break;
      case 'vendor_pricing':
        await tx.vendorPrice.update({
          where: { id },
          data: {
            vendor_id: v.vendor_id as string,
            ingredient_id: v.ingredient_id as string,
            price: v.price as number,
            unit: v.unit as string,
            effective_date: v.effective_date as Date,
          },
        });
        break;
      case 'missions':
        await tx.mission.update({
          where: { id },
          data: {
            title: v.title as string,
            description: v.description as string,
            phase: v.phase as string,
            scope: v.scope as string,
            start_date: v.start_date ? (v.start_date as Date) : undefined,
            end_date: v.end_date ? (v.end_date as Date) : undefined,
            // NEVER: progress_percent, status
          },
        });
        break;
      case 'quests':
        // D-02: Quest validator already blocks non-planned quests (status='blocked')
        // Only SAFE fields: description, week_number, start_date, end_date
        await tx.quest.update({
          where: { id },
          data: {
            title: v.title as string,
            description: v.description as string,
            week_number: v.week_number as number,
            start_date: v.start_date ? (v.start_date as Date) : undefined,
            end_date: v.end_date ? (v.end_date as Date) : undefined,
            // NEVER: baseline_task_count, *_progress_percent, status
          },
        });
        break;
      case 'tasks':
        // D-02: Task validator already blocks completed tasks (status='blocked')
        // Only SAFE fields: description, priority, xp, due_date, domain, task_type, readiness_meter, kpi, depends_on, requires_approval
        await tx.task.update({
          where: { id },
          data: {
            title: v.title as string,
            description: v.description as string,
            priority: v.priority as string,
            xp: (v.xp as number) ?? 25,
            due_date: v.due_date ? (v.due_date as Date) : undefined,
            domain: v.domain as string,
            task_type: v.task_type as string,
            readiness_meter_id: v.readiness_meter_id
              ? (v.readiness_meter_id as string)
              : undefined,
            kpi_id: v.kpi_id ? (v.kpi_id as string) : undefined,
            depends_on_task_id: v.depends_on_task_id
              ? (v.depends_on_task_id as string)
              : undefined,
            requires_approval: (v.requires_approval as boolean) ?? true,
            // NEVER: status, valid, verified, valid_xp, blocked, completed_at, readiness_value
          },
        });
        break;
      case 'kpis':
        // D-02: KPI validator blocks current_value change if existing>0 (status='blocked')
        await tx.kpi.update({
          where: { id },
          data: {
            description: v.description as string,
            unit: v.unit as string,
            target_value: v.target_value as number,
            domain: v.domain as string,
          },
        });
        break;
      case 'events':
        // D-02: Event validator blocks capacity reduction below bookings and date change with bookings (status='blocked')
        await tx.event.update({
          where: { id },
          data: {
            title: v.title as string,
            description: v.description ? (v.description as string) : undefined,
            price: v.price as number,
            event_type: v.event_type as string,
            zone_id: v.zone_id ? (v.zone_id as string) : undefined,
            brand_id: v.brand_id ? (v.brand_id as string) : undefined,
            capacity: v.capacity as number,
            date: v.date as Date,
          },
        });
        break;
      case 'product_categories':
        // D-02: Validator blocks brand_id change (status='blocked')
        await tx.productCategory.update({
          where: { id },
          data: {
            name: v.name as string,
            slug: v.slug as string,
            sort_order: (v.sort_order as number) ?? 0,
            // NEVER: status. BLOCKED: brand_id (caught by validator)
          },
        });
        break;
      case 'products':
        await tx.product.update({
          where: { id },
          data: {
            name: v.name as string,
            slug: v.slug as string,
            type: v.type as ProductType,
            recipe_id: v.recipe_id ? (v.recipe_id as string) : undefined,
            category_id: v.category_id as string,
            base_price: v.base_price as number,
            updated_by: userId,
            // NEVER: status — publishing stays a deliberate catalog action
          },
        });
        break;
      case 'purchase_orders':
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: (v.status as string) || 'draft',
            notes: v.notes ? (v.notes as string) : undefined,
            linked_task_id: v.linked_task_id
              ? (v.linked_task_id as string)
              : undefined,
          },
        });
        break;
      // opening_stock and recipes use their own commit paths — not handled here
    }
  }
}
