import { sanitizeRow } from '../../common/utils/csv-sanitize';
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { MenuService } from '../../menu/menu.service';
import { FeedbackService } from '../../feedback/feedback.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportBuilder } from '../exports.service';

@Injectable()
export class MenuItemsExportBuilder implements ExportBuilder {
  constructor(
    private readonly menuService: MenuService,
    private readonly prisma: PrismaService,
  ) {}

  async fetchData(): Promise<unknown[]> {
    return this.menuService.findAllForExport();
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const items = data as any[];
    const modifiers = await this.prisma.channelModifier.findMany({
      orderBy: { channel: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Menu Items');

    sheet.columns = [
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Category', key: 'category', width: 16 },
      {
        header: 'Base Price',
        key: 'base_price',
        width: 14,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Recipe Name', key: 'recipe_name', width: 24 },
      {
        header: 'Recipe Cost',
        key: 'recipe_cost',
        width: 14,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Channel Modifiers', key: 'channel_modifiers', width: 30 },
    ];

    const modifierStr = modifiers
      .map(
        (m) =>
          `${m.channel}: ${Number(m.modifier_value) >= 0 ? '+' : ''}${Number(m.modifier_value)}`,
      )
      .join('; ');

    for (const item of items) {
      sheet.addRow({
        name: item.name,
        category: item.category?.name || '',
        base_price: Number(item.base_price),
        status: item.status,
        recipe_name: item.recipe?.name || '',
        recipe_cost: item.recipe?.computed_cost
          ? Number(item.recipe.computed_cost)
          : 0,
        channel_modifiers: modifierStr,
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const items = data as any[];
    const modifiers = await this.prisma.channelModifier.findMany({
      orderBy: { channel: 'asc' },
    });

    const modifierStr = modifiers
      .map(
        (m) =>
          `${m.channel}: ${Number(m.modifier_value) >= 0 ? '+' : ''}${Number(m.modifier_value)}`,
      )
      .join('; ');

    const rows = items.map((item) => ({
      Name: item.name,
      Category: item.category?.name || '',
      'Base Price': Number(item.base_price),
      Status: item.status,
      'Recipe Name': item.recipe?.name || '',
      'Recipe Cost': item.recipe?.computed_cost
        ? Number(item.recipe.computed_cost)
        : 0,
      'Channel Modifiers': modifierStr,
    }));
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}

@Injectable()
export class FeedbackExportBuilder implements ExportBuilder {
  constructor(private readonly feedbackService: FeedbackService) {}

  async fetchData(dateFrom?: string, dateTo?: string): Promise<unknown[]> {
    return this.feedbackService.findAllForExport(dateFrom, dateTo);
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const feedbacks = data as any[];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback');

    sheet.columns = [
      { header: 'Order ID', key: 'order_id', width: 36 },
      { header: 'Rating', key: 'rating', width: 8 },
      { header: 'Comment', key: 'comment', width: 40 },
      { header: 'Customer Name', key: 'customer_name', width: 20 },
      { header: 'Customer Phone', key: 'customer_phone', width: 16 },
      {
        header: 'Created At',
        key: 'created_at',
        width: 22,
        style: { numFmt: 'YYYY-MM-DD HH:MM:SS' },
      },
    ];

    for (const fb of feedbacks) {
      sheet.addRow({
        order_id: fb.order?.id || fb.order_id || '',
        rating: fb.rating,
        comment: fb.comment || '',
        customer_name: fb.customer_name || '',
        customer_phone: fb.customer_phone || '',
        created_at: fb.created_at,
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const feedbacks = data as any[];
    const rows = feedbacks.map((fb) => ({
      'Order ID': fb.order?.id || fb.order_id || '',
      Rating: fb.rating,
      Comment: fb.comment || '',
      'Customer Name': fb.customer_name || '',
      'Customer Phone': fb.customer_phone || '',
      'Created At': fb.created_at?.toISOString() || '',
    }));
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}
