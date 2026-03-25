import { sanitizeRow } from '../../common/utils/csv-sanitize';
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { OrdersService } from '../../orders/orders.service';
import { ExportBuilder } from '../exports.service';

@Injectable()
export class OrdersExportBuilder implements ExportBuilder {
  constructor(private readonly ordersService: OrdersService) {}

  async fetchData(
    dateFrom?: string,
    dateTo?: string,
    filters?: string,
  ): Promise<unknown[]> {
    const parsed = filters ? JSON.parse(filters) : {};
    return this.ordersService.findAllForExport({
      dateFrom,
      dateTo,
      channel: parsed.channel,
      status: parsed.status,
    });
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const orders = data as any[];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Orders');

    sheet.columns = [
      { header: 'Order ID', key: 'id', width: 36 },
      { header: 'Channel', key: 'channel', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      {
        header: 'Subtotal',
        key: 'subtotal',
        width: 12,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Modifier Amount',
        key: 'modifier_amount',
        width: 16,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Total',
        key: 'total',
        width: 12,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Customer', key: 'customer_name', width: 20 },
      { header: 'Payment Method', key: 'payment_method', width: 16 },
      {
        header: 'Created At',
        key: 'created_at',
        width: 22,
        style: { numFmt: 'YYYY-MM-DD HH:MM:SS' },
      },
    ];

    for (const o of orders) {
      sheet.addRow({
        id: o.id,
        channel: o.channel,
        status: o.status,
        subtotal: Number(o.subtotal),
        modifier_amount: Number(o.channel_modifier_amount || 0),
        total: Number(o.total),
        customer_name: o.customer_name || '',
        payment_method: o.payment?.method || '',
        created_at: o.created_at,
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const orders = data as any[];
    const rows = orders.map((o) => ({
      'Order ID': o.id,
      Channel: o.channel,
      Status: o.status,
      Subtotal: Number(o.subtotal),
      'Modifier Amount': Number(o.channel_modifier_amount || 0),
      Total: Number(o.total),
      Customer: o.customer_name || '',
      'Payment Method': o.payment?.method || '',
      'Created At': o.created_at?.toISOString() || '',
    }));
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}
