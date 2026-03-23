import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import express from 'express';
import { ExportsService } from './exports.service';
import { GenerateExportDto } from './dto/generate-export.dto';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { PrismaService } from '../prisma/prisma.service';

@Controller('exports')
export class ExportsController {
  constructor(
    private readonly exportsService: ExportsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /exports/generate
   * Generate an export file. Permission check is done at the service level
   * because the required permission varies by report type.
   * The global JwtAuthGuard ensures authentication.
   */
  @Post('generate')
  async generate(
    @Body() dto: GenerateExportDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    const permissions = await getPermissionsForRole(
      user.roleCode,
      this.prisma,
    );
    return this.exportsService.generateExport(dto, user.id, permissions);
  }

  /**
   * GET /exports/history
   * Admin-only endpoint to view export history.
   */
  @Get('history')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  getHistory(
    @Query('reportType') reportType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.exportsService.getHistory({ reportType, dateFrom, dateTo });
  }
}
