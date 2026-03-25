import { sanitizeRow } from '../../common/utils/csv-sanitize';
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ExportBuilder } from '../exports.service';

/** Default date range: last 30 days */
function defaultDateRange(): { from: string; to: string } {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

// ---------------------------------------------------------------
// Revenue Summary Export Builder
// ---------------------------------------------------------------
@Injectable()
export class RevenueExportBuilder implements ExportBuilder {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async fetchData(dateFrom?: string, dateTo?: string): Promise<unknown[]> {
    const range = defaultDateRange();
    return this.analyticsService.getRevenueSeries(
      dateFrom || range.from,
      dateTo || range.to,
    );
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const rows = data as Array<{ date: string; revenue: number }>;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Revenue Summary');

    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      {
        header: 'Revenue',
        key: 'revenue',
        width: 14,
        style: { numFmt: '#,##0.00' },
      },
    ];

    for (const row of rows) {
      sheet.addRow({
        date: row.date,
        revenue: Number(row.revenue),
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const rows = (data as Array<{ date: string; revenue: number }>).map(
      (r) => ({
        Date: r.date,
        Revenue: Number(r.revenue),
      }),
    );
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}

// ---------------------------------------------------------------
// Top Items Export Builder
// ---------------------------------------------------------------
@Injectable()
export class TopItemsExportBuilder implements ExportBuilder {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async fetchData(dateFrom?: string, dateTo?: string): Promise<unknown[]> {
    const range = defaultDateRange();
    return this.analyticsService.getTopItems(
      dateFrom || range.from,
      dateTo || range.to,
    );
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const items = data as Array<{
      name: string;
      quantity_sold: number;
      revenue: number;
    }>;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Top Items');

    sheet.columns = [
      { header: 'Item Name', key: 'name', width: 30 },
      { header: 'Quantity Sold', key: 'quantity_sold', width: 14 },
      {
        header: 'Revenue',
        key: 'revenue',
        width: 14,
        style: { numFmt: '#,##0.00' },
      },
    ];

    for (const item of items) {
      sheet.addRow({
        name: item.name,
        quantity_sold: item.quantity_sold,
        revenue: Number(item.revenue),
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const rows = (
      data as Array<{ name: string; quantity_sold: number; revenue: number }>
    ).map((item) => ({
      'Item Name': item.name,
      'Quantity Sold': item.quantity_sold,
      Revenue: Number(item.revenue),
    }));
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}

// ---------------------------------------------------------------
// Channel Breakdown Export Builder
// ---------------------------------------------------------------
@Injectable()
export class ChannelBreakdownExportBuilder implements ExportBuilder {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async fetchData(dateFrom?: string, dateTo?: string): Promise<unknown[]> {
    const range = defaultDateRange();
    return this.analyticsService.getChannelBreakdown(
      dateFrom || range.from,
      dateTo || range.to,
    );
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const channels = data as Array<{
      channel: string;
      revenue: number;
      order_count: number;
    }>;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Channel Breakdown');

    sheet.columns = [
      { header: 'Channel', key: 'channel', width: 16 },
      {
        header: 'Revenue',
        key: 'revenue',
        width: 14,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Order Count', key: 'order_count', width: 14 },
    ];

    for (const ch of channels) {
      sheet.addRow({
        channel: ch.channel,
        revenue: Number(ch.revenue),
        order_count: ch.order_count,
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const rows = (
      data as Array<{
        channel: string;
        revenue: number;
        order_count: number;
      }>
    ).map((ch) => ({
      Channel: ch.channel,
      Revenue: Number(ch.revenue),
      'Order Count': ch.order_count,
    }));
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}

// ---------------------------------------------------------------
// Recipe Costs Export Builder
// ---------------------------------------------------------------
@Injectable()
export class RecipeCostsExportBuilder implements ExportBuilder {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async fetchData(dateFrom?: string, dateTo?: string): Promise<unknown[]> {
    const range = defaultDateRange();
    return this.analyticsService.getRecipeCosts(
      dateFrom || range.from,
      dateTo || range.to,
    );
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const recipes = data as Array<{
      recipe_name: string;
      computed_cost: number;
      selling_price: number;
      food_cost_pct: number;
      units_sold: number;
    }>;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Recipe Costs');

    sheet.columns = [
      { header: 'Recipe Name', key: 'recipe_name', width: 30 },
      {
        header: 'Computed Cost',
        key: 'computed_cost',
        width: 14,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Selling Price',
        key: 'selling_price',
        width: 14,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Food Cost %',
        key: 'food_cost_pct',
        width: 14,
        style: { numFmt: '0.0%' },
      },
      { header: 'Units Sold', key: 'units_sold', width: 12 },
    ];

    for (const r of recipes) {
      sheet.addRow({
        recipe_name: r.recipe_name,
        computed_cost: Number(r.computed_cost),
        selling_price: Number(r.selling_price),
        food_cost_pct: Number(r.food_cost_pct) / 100, // Convert percentage to decimal for Excel % format
        units_sold: r.units_sold,
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const rows = (
      data as Array<{
        recipe_name: string;
        computed_cost: number;
        selling_price: number;
        food_cost_pct: number;
        units_sold: number;
      }>
    ).map((r) => ({
      'Recipe Name': r.recipe_name,
      'Computed Cost': Number(r.computed_cost),
      'Selling Price': Number(r.selling_price),
      'Food Cost %': Number(r.food_cost_pct),
      'Units Sold': r.units_sold,
    }));
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}
