import { sanitizeRow } from '../../common/utils/csv-sanitize';
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { EventsService } from '../../events/events.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportBuilder } from '../exports.service';

@Injectable()
export class EventsExportBuilder implements ExportBuilder {
  constructor(private readonly eventsService: EventsService) {}

  async fetchData(): Promise<unknown[]> {
    return this.eventsService.findAllForExport();
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const events = data as any[];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Events');

    sheet.columns = [
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Event Type', key: 'event_type', width: 16 },
      {
        header: 'Date',
        key: 'date',
        width: 16,
        style: { numFmt: 'YYYY-MM-DD' },
      },
      { header: 'Capacity', key: 'capacity', width: 10 },
      {
        header: 'Price',
        key: 'price',
        width: 12,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Zone', key: 'zone', width: 16 },
      { header: 'Brand', key: 'brand', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    for (const e of events) {
      sheet.addRow({
        title: e.title,
        event_type: e.event_type,
        date: e.date,
        capacity: e.capacity,
        price: Number(e.price),
        zone: e.zone?.name || '',
        brand: e.brand?.name || '',
        status: e.status,
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const events = data as any[];
    const rows = events.map((e) => ({
      Title: e.title,
      'Event Type': e.event_type,
      Date: e.date?.toISOString().slice(0, 10) || '',
      Capacity: e.capacity,
      Price: Number(e.price),
      Zone: e.zone?.name || '',
      Brand: e.brand?.name || '',
      Status: e.status,
    }));
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}

@Injectable()
export class EventGuestListsExportBuilder implements ExportBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async fetchData(): Promise<unknown[]> {
    return this.prisma.eventBooking.findMany({
      orderBy: { created_at: 'desc' },
      include: { event: { select: { title: true } } },
    });
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const bookings = data as any[];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Event Guest Lists');

    sheet.columns = [
      { header: 'Event Title', key: 'event_title', width: 30 },
      { header: 'Customer Name', key: 'customer_name', width: 20 },
      { header: 'Customer Phone', key: 'customer_phone', width: 16 },
      { header: 'Guests', key: 'guests', width: 8 },
      {
        header: 'Created At',
        key: 'created_at',
        width: 22,
        style: { numFmt: 'YYYY-MM-DD HH:MM:SS' },
      },
    ];

    for (const b of bookings) {
      sheet.addRow({
        event_title: b.event?.title || '',
        customer_name: b.customer_name,
        customer_phone: b.customer_phone,
        guests: b.guests,
        created_at: b.created_at,
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const bookings = data as any[];
    const rows = bookings.map((b) => ({
      'Event Title': b.event?.title || '',
      'Customer Name': b.customer_name,
      'Customer Phone': b.customer_phone,
      Guests: b.guests,
      'Created At': b.created_at?.toISOString() || '',
    }));
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}
