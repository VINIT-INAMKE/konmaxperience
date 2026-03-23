import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import express from 'express';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { ImportsService } from './imports.service';
import { TemplateService } from './template.service';
import { CommitImportDto } from './dto/commit-import.dto';
import { IMPORT_TYPES, type ImportType } from './import-types';

@Controller('imports')
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly templateService: TemplateService,
  ) {}

  @Post('parse')
  @RequiresPermission('MANAGE_SYSTEM')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Only CSV and XLSX files are accepted'),
            false,
          );
        }
      },
    }),
  )
  async parseImport(
    @UploadedFile() file: Express.Multer.File,
    @Body('importType') importType: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!IMPORT_TYPES.includes(importType as ImportType)) {
      throw new BadRequestException(
        `Invalid import type: ${importType}. Valid types: ${IMPORT_TYPES.join(', ')}`,
      );
    }

    // D-13: Recipes require XLSX format
    if (
      importType === 'recipes' &&
      (file.mimetype === 'text/csv' ||
        file.mimetype === 'application/vnd.ms-excel')
    ) {
      throw new BadRequestException(
        'Recipes require XLSX format — CSV is not supported',
      );
    }

    return this.importsService.parseFile(
      file.buffer,
      file.mimetype,
      importType as ImportType,
    );
  }

  @Post('commit')
  @RequiresPermission('MANAGE_SYSTEM')
  async commitImport(@Body() dto: CommitImportDto, @Req() req: any) {
    return this.importsService.commitImport(
      dto.importType,
      dto.rows,
      dto.updateExisting ?? false,
      req.user.id,
      dto.bomRows,
    );
  }

  @Get('prerequisites')
  @RequiresPermission('MANAGE_SYSTEM')
  async getPrerequisites() {
    return this.importsService.getPrerequisites();
  }

  @Get('template/:type')
  @RequiresPermission('MANAGE_SYSTEM')
  async downloadTemplate(
    @Param('type') type: string,
    @Res() res: express.Response,
  ) {
    if (!IMPORT_TYPES.includes(type as ImportType)) {
      throw new BadRequestException(`Invalid import type: ${type}`);
    }
    const importType = type as ImportType;

    // Default to XLSX (includes Instructions sheet per D-10)
    const buffer = await this.templateService.generateXlsx(importType);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${importType}_template.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('template/:type/csv')
  @RequiresPermission('MANAGE_SYSTEM')
  async downloadCsvTemplate(
    @Param('type') type: string,
    @Res() res: express.Response,
  ) {
    if (!IMPORT_TYPES.includes(type as ImportType)) {
      throw new BadRequestException(`Invalid import type: ${type}`);
    }
    const buffer = await this.templateService.generateCsv(
      type as ImportType,
    );
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${type}_template.csv"`,
    });
    res.send(buffer);
  }
}
