import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { ExportBuilder } from '../exports.service';
import { WasteService } from '../../kitchen/waste/waste.service';
import { PrepBatchesService } from '../../kitchen/prep-batches/prep-batches.service';

@Injectable()
export class WasteLogExportBuilder implements ExportBuilder {
  constructor(private readonly wasteService: WasteService) {}

  async fetchData(dateFrom?: string, dateTo?: string): Promise<unknown[]> {
    return this.wasteService.findAllForExport(dateFrom, dateTo);
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Waste Log');

    sheet.columns = [
      { header: 'Waste Type', key: 'waste_type', width: 16 },
      { header: 'Item Name', key: 'item_name', width: 24 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Reason', key: 'reason', width: 30 },
      { header: 'Cost Impact', key: 'cost_impact', width: 14 },
      { header: 'Zone', key: 'zone', width: 16 },
      { header: 'Logged By', key: 'logged_by', width: 20 },
      { header: 'Created At', key: 'created_at', width: 22 },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const row of data as any[]) {
      const itemName =
        row.ingredient?.name || row.prep_batch?.recipe?.name || 'N/A';
      sheet.addRow({
        waste_type: row.waste_type,
        item_name: itemName,
        quantity: Number(row.quantity),
        unit: row.unit,
        reason: row.reason,
        cost_impact: Number(row.cost_impact),
        zone: row.zone?.name || '',
        logged_by: row.creator?.name || '',
        created_at: row.created_at,
      });
    }

    sheet.getColumn('quantity').numFmt = '#,##0.00';
    sheet.getColumn('cost_impact').numFmt = '#,##0.00';
    sheet.getColumn('created_at').numFmt = 'YYYY-MM-DD HH:MM:SS';

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const rows = (data as any[]).map((row) => {
      const itemName =
        row.ingredient?.name || row.prep_batch?.recipe?.name || 'N/A';
      return {
        waste_type: row.waste_type,
        item_name: itemName,
        quantity: Number(row.quantity),
        unit: row.unit,
        reason: row.reason,
        cost_impact: Number(row.cost_impact),
        zone: row.zone?.name || '',
        logged_by: row.creator?.name || '',
        created_at: row.created_at
          ? new Date(row.created_at).toISOString()
          : '',
      };
    });
    return writeToBuffer(rows, { headers: true });
  }
}

@Injectable()
export class PrepBatchesExportBuilder implements ExportBuilder {
  constructor(private readonly prepBatchesService: PrepBatchesService) {}

  async fetchData(dateFrom?: string, dateTo?: string): Promise<unknown[]> {
    return this.prepBatchesService.findAllForExport(dateFrom, dateTo);
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Prep Batches');

    sheet.columns = [
      { header: 'Recipe', key: 'recipe', width: 24 },
      { header: 'Zone', key: 'zone', width: 16 },
      { header: 'Qty Produced', key: 'qty_produced', width: 14 },
      { header: 'Qty Remaining', key: 'qty_remaining', width: 14 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Expires At', key: 'expires_at', width: 22 },
      { header: 'Created At', key: 'created_at', width: 22 },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const row of data as any[]) {
      sheet.addRow({
        recipe: row.recipe?.name || '',
        zone: row.zone?.name || '',
        qty_produced: Number(row.quantity_produced),
        qty_remaining: Number(row.quantity_remaining),
        unit: row.unit,
        status: row.status,
        expires_at: row.expires_at || '',
        created_at: row.created_at,
      });
    }

    sheet.getColumn('qty_produced').numFmt = '#,##0.00';
    sheet.getColumn('qty_remaining').numFmt = '#,##0.00';
    sheet.getColumn('expires_at').numFmt = 'YYYY-MM-DD HH:MM:SS';
    sheet.getColumn('created_at').numFmt = 'YYYY-MM-DD HH:MM:SS';

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const rows = (data as any[]).map((row) => ({
      recipe: row.recipe?.name || '',
      zone: row.zone?.name || '',
      qty_produced: Number(row.quantity_produced),
      qty_remaining: Number(row.quantity_remaining),
      unit: row.unit,
      status: row.status,
      expires_at: row.expires_at
        ? new Date(row.expires_at).toISOString()
        : '',
      created_at: row.created_at
        ? new Date(row.created_at).toISOString()
        : '',
    }));
    return writeToBuffer(rows, { headers: true });
  }
}
