import { sanitizeRow } from '../../common/utils/csv-sanitize';
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { writeToBuffer } from '@fast-csv/format';
import { TasksService } from '../../tasks/tasks.service';
import { KpisService } from '../../kpis/kpis.service';
import { DecisionsService } from '../../decisions/decisions.service';
import { PrismaService } from '../../prisma/prisma.service';
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
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
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
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}

@Injectable()
export class DecisionLogExportBuilder implements ExportBuilder {
  constructor(private readonly decisionsService: DecisionsService) {}

  async fetchData(
    _dateFrom?: string,
    _dateTo?: string,
    _filters?: string,
  ): Promise<unknown[]> {
    return this.decisionsService.findAllForExport();
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const decisions = data as any[];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Decision Log');

    sheet.columns = [
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Decision Type', key: 'decision_type', width: 16 },
      { header: 'Context', key: 'context', width: 40 },
      { header: 'Proposed By', key: 'proposed_by', width: 20 },
      { header: 'Impact Scope', key: 'impact_scope', width: 16 },
      { header: 'Final Decision', key: 'final_decision', width: 40 },
      { header: 'Status', key: 'status', width: 12 },
      {
        header: 'Created At',
        key: 'created_at',
        width: 22,
        style: { numFmt: 'YYYY-MM-DD HH:MM:SS' },
      },
    ];

    for (const d of decisions) {
      sheet.addRow({
        title: d.title,
        decision_type: d.decision_type,
        context: d.context,
        proposed_by: d.proposer?.name || '',
        impact_scope: d.impact_scope,
        final_decision: d.final_decision || '',
        status: d.status,
        created_at: d.created_at,
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const decisions = data as any[];
    const rows = decisions.map((d) => ({
      Title: d.title,
      'Decision Type': d.decision_type,
      Context: d.context,
      'Proposed By': d.proposer?.name || '',
      'Impact Scope': d.impact_scope,
      'Final Decision': d.final_decision || '',
      Status: d.status,
      'Created At': d.created_at?.toISOString() || '',
    }));
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}

@Injectable()
export class LeaderboardExportBuilder implements ExportBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async fetchData(
    _dateFrom?: string,
    _dateTo?: string,
    _filters?: string,
  ): Promise<unknown[]> {
    return this.prisma.user.findMany({
      where: { status: 'active' },
      orderBy: { xp_total: 'desc' },
      include: { role: { select: { name: true } } },
    });
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const users = data as any[];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Leaderboard');

    sheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Role', key: 'role', width: 20 },
      { header: 'XP Total', key: 'xp_total', width: 10 },
      { header: 'Level', key: 'level', width: 8 },
      { header: 'Streak Days', key: 'streak_days', width: 12 },
    ];

    for (const u of users) {
      sheet.addRow({
        name: u.name,
        role: u.role?.name || '',
        xp_total: u.xp_total,
        level: u.level,
        streak_days: u.streak_days,
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const users = data as any[];
    const rows = users.map((u) => ({
      Name: u.name,
      Role: u.role?.name || '',
      'XP Total': u.xp_total,
      Level: u.level,
      'Streak Days': u.streak_days,
    }));
    return writeToBuffer(rows.map(sanitizeRow), { headers: true });
  }
}
