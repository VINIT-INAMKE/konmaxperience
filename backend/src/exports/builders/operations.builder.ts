import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { TasksService } from '../../tasks/tasks.service';
import { KpisService } from '../../kpis/kpis.service';
import { ExportBuilder } from '../exports.service';

@Injectable()
export class TasksExportBuilder implements ExportBuilder {
  constructor(private readonly tasksService: TasksService) {}

  async fetchData(
    _dateFrom?: string,
    _dateTo?: string,
    _filters?: string,
  ): Promise<unknown[]> {
    return this.tasksService.findAllForExport();
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const tasks = data as any[];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tasks');

    sheet.columns = [
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Domain', key: 'domain', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'XP', key: 'xp', width: 8 },
      { header: 'Valid XP', key: 'valid_xp', width: 8 },
      { header: 'Owner', key: 'owner', width: 20 },
      { header: 'Quest', key: 'quest', width: 24 },
      {
        header: 'Due Date',
        key: 'due_date',
        width: 16,
        style: { numFmt: 'YYYY-MM-DD' },
      },
      {
        header: 'Completed At',
        key: 'completed_at',
        width: 22,
        style: { numFmt: 'YYYY-MM-DD HH:MM:SS' },
      },
    ];

    for (const t of tasks) {
      sheet.addRow({
        title: t.title,
        domain: t.domain,
        status: t.status,
        priority: t.priority,
        xp: t.xp,
        valid_xp: t.valid_xp,
        owner: t.owner?.name || '',
        quest: t.quest?.title || '',
        due_date: t.due_date,
        completed_at: t.completed_at,
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const tasks = data as any[];
    const rows = tasks.map((t) => ({
      Title: t.title,
      Domain: t.domain,
      Status: t.status,
      Priority: t.priority,
      XP: t.xp,
      'Valid XP': t.valid_xp,
      Owner: t.owner?.name || '',
      Quest: t.quest?.title || '',
      'Due Date': t.due_date?.toISOString()?.slice(0, 10) || '',
      'Completed At': t.completed_at?.toISOString() || '',
    }));
    return writeToBuffer(rows, { headers: true });
  }
}

@Injectable()
export class KpisExportBuilder implements ExportBuilder {
  constructor(private readonly kpisService: KpisService) {}

  async fetchData(
    _dateFrom?: string,
    _dateTo?: string,
    _filters?: string,
  ): Promise<unknown[]> {
    return this.kpisService.findAllForExport();
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const kpis = data as any[];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('KPIs');

    sheet.columns = [
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Unit', key: 'unit', width: 10 },
      {
        header: 'Target Value',
        key: 'target_value',
        width: 14,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Current Value',
        key: 'current_value',
        width: 14,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Domain', key: 'domain', width: 16 },
    ];

    for (const k of kpis) {
      sheet.addRow({
        name: k.name,
        description: k.description,
        unit: k.unit,
        target_value: Number(k.target_value),
        current_value: Number(k.current_value),
        status: k.status,
        domain: k.domain,
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const kpis = data as any[];
    const rows = kpis.map((k) => ({
      Name: k.name,
      Description: k.description,
      Unit: k.unit,
      'Target Value': Number(k.target_value),
      'Current Value': Number(k.current_value),
      Status: k.status,
      Domain: k.domain,
    }));
    return writeToBuffer(rows, { headers: true });
  }
}
