import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
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
import { validateMenuCategoryRow } from './validators/menu-categories.validator';
import { validateMenuItemRow } from './validators/menu-items.validator';
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
    const rawRows =
      mimetype === 'text/csv' || mimetype === 'application/vnd.ms-excel'
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
    if (importType === 'opening_stock') {
      const fileHash = createHash('sha256').update(buffer).digest('hex');
      const existingImport = await this.prisma.stockMovement.findFirst({
        where: { reference_type: 'import', reference_id: fileHash },
        select: { created_at: true },
      });
      if (existingImport) {
        warning = `This file was already imported on ${existingImport.created_at.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}. Re-importing will create duplicate stock movements.`;
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
      case 'menu_categories':
        return validateMenuCategoryRow(raw, rowIndex, this.prisma);
      case 'menu_items':
        return validateMenuItemRow(raw, rowIndex, this.prisma);
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
  ): Promise<CommitResult> {
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
      menuCategories,
    ] = await Promise.all([
      this.prisma.ingredient.count(),
      this.prisma.vendor.count(),
      this.prisma.zone.count(),
      this.prisma.brand.count(),
      this.prisma.mission.count(),
      this.prisma.quest.count(),
      this.prisma.recipe.count({ where: { status: 'approved' } }),
      this.prisma.menuCategory.count(),
    ]);
    return {
      ingredients,
      vendors,
      zones,
      brands,
      missions,
      quests,
      approved_recipes: approvedRecipes,
      menu_categories: menuCategories,
    };
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
            category: v.category as string,
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
      // New import types will have createRow cases added in Plan 04
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
            category: v.category as string,
            base_unit: v.base_unit as string,
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
      // New import types will have updateRow cases added in Plan 04
    }
  }
}
