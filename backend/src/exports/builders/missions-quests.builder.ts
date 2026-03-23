import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { MissionsService } from '../../missions/missions.service';
import { QuestsService } from '../../quests/quests.service';
import { ExportBuilder } from '../exports.service';

@Injectable()
export class MissionsExportBuilder implements ExportBuilder {
  constructor(private readonly missionsService: MissionsService) {}

  async fetchData(
    _dateFrom?: string,
    _dateTo?: string,
    _filters?: string,
  ): Promise<unknown[]> {
    return this.missionsService.findAllForExport();
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const missions = data as any[];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Missions');

    sheet.columns = [
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Phase', key: 'phase', width: 14 },
      { header: 'Scope', key: 'scope', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Progress %', key: 'progress_percent', width: 12 },
      { header: 'Quests Count', key: 'quests_count', width: 12 },
      {
        header: 'Start Date',
        key: 'start_date',
        width: 16,
        style: { numFmt: 'YYYY-MM-DD' },
      },
      {
        header: 'End Date',
        key: 'end_date',
        width: 16,
        style: { numFmt: 'YYYY-MM-DD' },
      },
      {
        header: 'Created At',
        key: 'created_at',
        width: 22,
        style: { numFmt: 'YYYY-MM-DD HH:MM:SS' },
      },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const m of missions) {
      sheet.addRow({
        title: m.title,
        description: m.description,
        phase: m.phase,
        scope: m.scope,
        status: m.status,
        progress_percent: m.progress_percent,
        quests_count: m._count?.quests ?? 0,
        start_date: m.start_date,
        end_date: m.end_date,
        created_at: m.created_at,
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const missions = data as any[];
    const rows = missions.map((m) => ({
      Title: m.title,
      Description: m.description,
      Phase: m.phase,
      Scope: m.scope,
      Status: m.status,
      'Progress %': m.progress_percent,
      'Quests Count': m._count?.quests ?? 0,
      'Start Date': m.start_date?.toISOString()?.slice(0, 10) || '',
      'End Date': m.end_date?.toISOString()?.slice(0, 10) || '',
      'Created At': m.created_at?.toISOString() || '',
    }));
    return writeToBuffer(rows, { headers: true });
  }
}

@Injectable()
export class QuestsExportBuilder implements ExportBuilder {
  constructor(private readonly questsService: QuestsService) {}

  async fetchData(
    _dateFrom?: string,
    _dateTo?: string,
    _filters?: string,
  ): Promise<unknown[]> {
    return this.questsService.findAllForExport();
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const quests = data as any[];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Quests');

    sheet.columns = [
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Mission', key: 'mission', width: 24 },
      { header: 'Week #', key: 'week_number', width: 10 },
      { header: 'Owner', key: 'owner', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Baseline Tasks', key: 'baseline_task_count', width: 14 },
      { header: 'Core Progress %', key: 'core_progress_percent', width: 14 },
      { header: 'Ad-hoc Progress %', key: 'adhoc_progress_percent', width: 14 },
      { header: 'Overall Progress %', key: 'progress_percent', width: 14 },
      { header: 'Task Count', key: 'task_count', width: 12 },
      {
        header: 'Start Date',
        key: 'start_date',
        width: 16,
        style: { numFmt: 'YYYY-MM-DD' },
      },
      {
        header: 'End Date',
        key: 'end_date',
        width: 16,
        style: { numFmt: 'YYYY-MM-DD' },
      },
      {
        header: 'Created At',
        key: 'created_at',
        width: 22,
        style: { numFmt: 'YYYY-MM-DD HH:MM:SS' },
      },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const q of quests) {
      sheet.addRow({
        title: q.title,
        description: q.description,
        mission: q.mission?.title || '',
        week_number: q.week_number,
        owner: q.owner?.name || '',
        status: q.status,
        baseline_task_count: q.baseline_task_count,
        core_progress_percent: q.core_progress_percent,
        adhoc_progress_percent: q.adhoc_progress_percent,
        progress_percent: q.progress_percent,
        task_count: q._count?.tasks ?? 0,
        start_date: q.start_date,
        end_date: q.end_date,
        created_at: q.created_at,
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const quests = data as any[];
    const rows = quests.map((q) => ({
      Title: q.title,
      Description: q.description,
      Mission: q.mission?.title || '',
      'Week #': q.week_number,
      Owner: q.owner?.name || '',
      Status: q.status,
      'Baseline Tasks': q.baseline_task_count,
      'Core Progress %': q.core_progress_percent,
      'Ad-hoc Progress %': q.adhoc_progress_percent,
      'Overall Progress %': q.progress_percent,
      'Task Count': q._count?.tasks ?? 0,
      'Start Date': q.start_date?.toISOString()?.slice(0, 10) || '',
      'End Date': q.end_date?.toISOString()?.slice(0, 10) || '',
      'Created At': q.created_at?.toISOString() || '',
    }));
    return writeToBuffer(rows, { headers: true });
  }
}
