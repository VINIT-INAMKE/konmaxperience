import { sanitizeRow } from '../../common/utils/csv-sanitize';
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { PurchaseOrdersService } from '../../purchase-orders/purchase-orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ExportBuilder } from '../exports.service';

@Injectable()
export class PurchaseOrdersExportBuilder implements ExportBuilder {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
  ) {}

  async fetchData(dateFrom?: string, dateTo?: string): Promise<unknown[]> {
    return this.purchaseOrdersService.findAllForExport(dateFrom, dateTo);
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const pos = data as any[];

    // Sheet 1: Purchase Orders
    const poSheet = workbook.addWorksheet('Purchase Orders');
    poSheet.columns = [
      { header: 'PO ID', key: 'id', width: 36 },
      { header: 'Vendor', key: 'vendor', width: 24 },
      { header: 'Zone', key: 'zone', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      {
        header: 'Total Amount',
        key: 'total_amount',
        width: 14,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Ordered By', key: 'ordered_by', width: 20 },
      {
        header: 'Ordered At',
        key: 'ordered_at',
        width: 22,
        style: { numFmt: 'YYYY-MM-DD HH:MM:SS' },
      },
    ];

    for (const po of pos) {
      poSheet.addRow({
        id: po.id,
        vendor: po.vendor?.name ?? '',
        zone: po.zone?.name ?? '',
        status: po.status ?? '',
        total_amount: Number(po.total_amount),
        ordered_by: po.ordered_by_user?.name ?? '',
        ordered_at: po.ordered_at ? new Date(po.ordered_at) : '',
      });
    }

    // Sheet 2: Line Items
    const lineSheet = workbook.addWorksheet('Line Items');
    lineSheet.columns = [
      { header: 'PO ID', key: 'po_id', width: 36 },
      { header: 'Ingredient', key: 'ingredient', width: 24 },
      {
        header: 'Qty',
        key: 'qty',
        width: 10,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Unit', key: 'unit', width: 8 },
      {
        header: 'Unit Cost',
        key: 'unit_cost',
        width: 12,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Received Qty',
        key: 'received_qty',
        width: 12,
        style: { numFmt: '#,##0.00' },
      },
    ];

    for (const po of pos) {
      for (const line of po.lines ?? []) {
        lineSheet.addRow({
          po_id: po.id,
          ingredient: line.ingredient?.name ?? '',
          qty: Number(line.quantity),
          unit: line.unit ?? '',
          unit_cost: Number(line.unit_cost),
          received_qty: Number(line.received_quantity ?? 0),
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    // CSV mode: flatten — include PO header fields on every line item row
    const rows: Record<string, unknown>[] = [];
    const pos = data as any[];

    for (const po of pos) {
      if (!po.lines || po.lines.length === 0) {
        rows.push({
          'PO ID': po.id,
          Vendor: po.vendor?.name ?? '',
          Zone: po.zone?.name ?? '',
          Status: po.status ?? '',
          'Total Amount': Number(po.total_amount),
          'Ordered By': po.ordered_by_user?.name ?? '',
          'Ordered At': po.ordered_at
            ? new Date(po.ordered_at)
                .toISOString()
                .replace('T', ' ')
                .slice(0, 19)
            : '',
          Ingredient: '',
          Qty: '',
          Unit: '',
          'Unit Cost': '',
          'Received Qty': '',
        });
      } else {
        for (const line of po.lines) {
          rows.push({
            'PO ID': po.id,
            Vendor: po.vendor?.name ?? '',
            Zone: po.zone?.name ?? '',
            Status: po.status ?? '',
            'Total Amount': Number(po.total_amount),
            'Ordered By': po.ordered_by_user?.name ?? '',
            'Ordered At': po.ordered_at
              ? new Date(po.ordered_at)
                  .toISOString()
                  .replace('T', ' ')
                  .slice(0, 19)
              : '',
            Ingredient: line.ingredient?.name ?? '',
            Qty: Number(line.quantity),
            Unit: line.unit ?? '',
            'Unit Cost': Number(line.unit_cost),
            'Received Qty': Number(line.received_quantity ?? 0),
          });
        }
      }
    }

    return writeToBuffer(rows.map(sanitizeRow), {
      headers: [
        'PO ID',
        'Vendor',
        'Zone',
        'Status',
        'Total Amount',
        'Ordered By',
        'Ordered At',
        'Ingredient',
        'Qty',
        'Unit',
        'Unit Cost',
        'Received Qty',
      ],
    });
  }
}

@Injectable()
export class VendorPricingExportBuilder implements ExportBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async fetchData(): Promise<unknown[]> {
    return this.prisma.vendorPrice.findMany({
      orderBy: [{ vendor: { name: 'asc' } }, { ingredient: { name: 'asc' } }],
      include: {
        vendor: { select: { name: true } },
        ingredient: { select: { name: true } },
      },
    });
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Vendor Pricing');

    sheet.columns = [
      { header: 'Vendor', key: 'vendor', width: 24 },
      { header: 'Ingredient', key: 'ingredient', width: 24 },
      {
        header: 'Price',
        key: 'price',
        width: 12,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Unit', key: 'unit', width: 10 },
      {
        header: 'Effective Date',
        key: 'effective_date',
        width: 16,
        style: { numFmt: 'YYYY-MM-DD' },
      },
    ];

    for (const vp of data as any[]) {
      sheet.addRow({
        vendor: vp.vendor?.name ?? '',
        ingredient: vp.ingredient?.name ?? '',
        price: Number(vp.price),
        unit: vp.unit ?? '',
        effective_date: vp.effective_date
          ? new Date(vp.effective_date)
          : '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const rows = (data as any[]).map((vp) => ({
      Vendor: vp.vendor?.name ?? '',
      Ingredient: vp.ingredient?.name ?? '',
      Price: Number(vp.price),
      Unit: vp.unit ?? '',
      'Effective Date': vp.effective_date
        ? new Date(vp.effective_date).toISOString().slice(0, 10)
        : '',
    }));

    return writeToBuffer(rows.map(sanitizeRow), {
      headers: ['Vendor', 'Ingredient', 'Price', 'Unit', 'Effective Date'],
    });
  }
}
