import { sanitizeRow } from '../../common/utils/csv-sanitize';
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { InventoryService } from '../../inventory/inventory.service';
import type { ExportBuilder } from '../exports.service';

@Injectable()
export class InventoryLevelsExportBuilder implements ExportBuilder {
  constructor(private readonly inventoryService: InventoryService) {}

  async fetchData(): Promise<unknown[]> {
    return this.inventoryService.findAllForExport();
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventory Levels');

    sheet.columns = [
      { header: 'Ingredient', key: 'ingredient', width: 24 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Zone', key: 'zone', width: 16 },
      {
        header: 'Current Qty',
        key: 'current_qty',
        width: 12,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Unit', key: 'unit', width: 10 },
      {
        header: 'Min Stock',
        key: 'min_stock',
        width: 12,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Low Stock', key: 'low_stock', width: 10 },
    ];

    for (const s of data as any[]) {
      sheet.addRow({
        ingredient: s.ingredient?.name ?? '',
        category: s.ingredient?.category_obj?.name ?? '',
        zone: s.zone?.name ?? '',
        current_qty: Number(s.current_quantity),
        unit: s.ingredient?.base_unit ?? '',
        min_stock: Number(s.ingredient?.min_stock_level ?? 0),
        low_stock:
          Number(s.current_quantity) <
          Number(s.ingredient?.min_stock_level ?? 0)
            ? 'Yes'
            : 'No',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const rows = (data as any[]).map((s) => ({
      Ingredient: s.ingredient?.name ?? '',
      Category: s.ingredient?.category_obj?.name ?? '',
      Zone: s.zone?.name ?? '',
      'Current Qty': Number(s.current_quantity),
      Unit: s.ingredient?.base_unit ?? '',
      'Min Stock': Number(s.ingredient?.min_stock_level ?? 0),
      'Low Stock':
        Number(s.current_quantity) <
        Number(s.ingredient?.min_stock_level ?? 0)
          ? 'Yes'
          : 'No',
    }));

    return writeToBuffer(rows.map(sanitizeRow), {
      headers: [
        'Ingredient',
        'Category',
        'Zone',
        'Current Qty',
        'Unit',
        'Min Stock',
        'Low Stock',
      ],
    });
  }
}

@Injectable()
export class StockMovementsExportBuilder implements ExportBuilder {
  constructor(private readonly inventoryService: InventoryService) {}

  async fetchData(dateFrom?: string, dateTo?: string): Promise<unknown[]> {
    return this.inventoryService.findMovementsForExport(dateFrom, dateTo);
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Stock Movements');

    sheet.columns = [
      { header: 'Ingredient', key: 'ingredient', width: 24 },
      { header: 'Zone', key: 'zone', width: 16 },
      { header: 'Movement Type', key: 'movement_type', width: 16 },
      {
        header: 'Quantity',
        key: 'quantity',
        width: 12,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Reason', key: 'reason', width: 30 },
      { header: 'Created By', key: 'created_by', width: 20 },
      {
        header: 'Created At',
        key: 'created_at',
        width: 22,
        style: { numFmt: 'YYYY-MM-DD HH:MM:SS' },
      },
    ];

    for (const m of data as any[]) {
      sheet.addRow({
        ingredient: m.ingredient?.name ?? '',
        zone: m.zone?.name ?? '',
        movement_type: m.movement_type ?? '',
        quantity: Number(m.quantity),
        unit: m.unit ?? '',
        reason: m.reason ?? '',
        created_by: m.creator?.name ?? '',
        created_at: m.created_at ? new Date(m.created_at) : '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const rows = (data as any[]).map((m) => ({
      Ingredient: m.ingredient?.name ?? '',
      Zone: m.zone?.name ?? '',
      'Movement Type': m.movement_type ?? '',
      Quantity: Number(m.quantity),
      Unit: m.unit ?? '',
      Reason: m.reason ?? '',
      'Created By': m.creator?.name ?? '',
      'Created At': m.created_at
        ? new Date(m.created_at).toISOString().replace('T', ' ').slice(0, 19)
        : '',
    }));

    return writeToBuffer(rows.map(sanitizeRow), {
      headers: [
        'Ingredient',
        'Zone',
        'Movement Type',
        'Quantity',
        'Unit',
        'Reason',
        'Created By',
        'Created At',
      ],
    });
  }
}
