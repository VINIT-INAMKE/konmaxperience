import { sanitizeRow } from '../../common/utils/csv-sanitize';
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { ExportBuilder } from '../exports.service';
import { IngredientsService } from '../../ingredients/ingredients.service';
import { VendorsService } from '../../vendors/vendors.service';
import { RecipesService } from '../../recipes/recipes.service';

@Injectable()
export class IngredientsExportBuilder implements ExportBuilder {
  constructor(private readonly ingredientsService: IngredientsService) {}

  async fetchData(): Promise<unknown[]> {
    return this.ingredientsService.findAllForExport();
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ingredients');

    sheet.columns = [
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Base Unit', key: 'base_unit', width: 10 },
      { header: 'Min Stock Level', key: 'min_stock_level', width: 14 },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const row of data as any[]) {
      sheet.addRow({
        name: row.name,
        category: row.category,
        base_unit: row.base_unit,
        min_stock_level: Number(row.min_stock_level),
      });
    }

    sheet.getColumn('min_stock_level').numFmt = '#,##0.00';

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const rows = (data as any[]).map((row) => ({
      name: row.name,
      category: row.category,
      base_unit: row.base_unit,
      min_stock_level: Number(row.min_stock_level),
    }));
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}

@Injectable()
export class VendorsExportBuilder implements ExportBuilder {
  constructor(private readonly vendorsService: VendorsService) {}

  async fetchData(): Promise<unknown[]> {
    return this.vendorsService.findAllForExport();
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Vendors');

    sheet.columns = [
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Payment Terms', key: 'payment_terms', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const row of data as any[]) {
      sheet.addRow({
        name: row.name,
        phone: row.phone || '',
        email: row.email || '',
        address: row.address || '',
        payment_terms: row.payment_terms || '',
        status: row.status,
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const rows = (data as any[]).map((row) => ({
      name: row.name,
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      payment_terms: row.payment_terms || '',
      status: row.status,
    }));
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}

@Injectable()
export class RecipesExportBuilder implements ExportBuilder {
  constructor(private readonly recipesService: RecipesService) {}

  async fetchData(): Promise<unknown[]> {
    return this.recipesService.findAllForExport();
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const recipes = data as any[];
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Recipes
    const recipesSheet = workbook.addWorksheet('Recipes');
    recipesSheet.columns = [
      { header: 'Recipe ID', key: 'id', width: 36 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Yield Qty', key: 'yield_qty', width: 12 },
      { header: 'Yield Unit', key: 'yield_unit', width: 10 },
      { header: 'Computed Cost', key: 'computed_cost', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Created By', key: 'created_by', width: 20 },
    ];
    recipesSheet.getRow(1).font = { bold: true };

    for (const r of recipes) {
      recipesSheet.addRow({
        id: r.id,
        name: r.name,
        category: r.cooking_method || '',
        yield_qty: Number(r.yield_qty),
        yield_unit: r.yield_unit,
        computed_cost: r.computed_cost != null ? Number(r.computed_cost) : 0,
        status: r.status,
        created_by: r.creator?.name || '',
      });
    }

    recipesSheet.getColumn('yield_qty').numFmt = '#,##0.00';
    recipesSheet.getColumn('computed_cost').numFmt = '#,##0.00';

    // Sheet 2: BOM Lines
    const bomSheet = workbook.addWorksheet('BOM Lines');
    bomSheet.columns = [
      { header: 'Recipe ID', key: 'recipe_id', width: 36 },
      { header: 'Recipe Name', key: 'recipe_name', width: 24 },
      { header: 'Ingredient', key: 'ingredient', width: 24 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
    ];
    bomSheet.getRow(1).font = { bold: true };

    for (const r of recipes) {
      if (r.RecipeLines) {
        for (const line of r.RecipeLines) {
          bomSheet.addRow({
            recipe_id: r.id,
            recipe_name: r.name,
            ingredient: line.ingredient?.name || 'Sub-recipe',
            quantity: Number(line.quantity),
            unit: line.unit,
          });
        }
      }
    }

    bomSheet.getColumn('quantity').numFmt = '#,##0.00';

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    // Flatten: one row per BOM line with recipe info repeated
    const recipes = data as any[];
    const rows: Record<string, unknown>[] = [];

    for (const r of recipes) {
      if (r.RecipeLines && r.RecipeLines.length > 0) {
        for (const line of r.RecipeLines) {
          rows.push({
            recipe_id: r.id,
            recipe_name: r.name,
            yield_qty: Number(r.yield_qty),
            yield_unit: r.yield_unit,
            computed_cost:
              r.computed_cost != null ? Number(r.computed_cost) : 0,
            status: r.status,
            created_by: r.creator?.name || '',
            ingredient: line.ingredient?.name || 'Sub-recipe',
            bom_quantity: Number(line.quantity),
            bom_unit: line.unit,
          });
        }
      } else {
        // Recipe with no BOM lines: still include it
        rows.push({
          recipe_id: r.id,
          recipe_name: r.name,
          yield_qty: Number(r.yield_qty),
          yield_unit: r.yield_unit,
          computed_cost:
            r.computed_cost != null ? Number(r.computed_cost) : 0,
          status: r.status,
          created_by: r.creator?.name || '',
          ingredient: '',
          bom_quantity: '',
          bom_unit: '',
        });
      }
    }

    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}
