import {
  Injectable,
  ForbiddenException,
  NotImplementedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GenerateExportDto } from './dto/generate-export.dto';
import {
  EXPORT_TYPE_CONFIG,
  ReportType,
} from './export-types';

export interface ExportBuilder {
  buildXlsx(data: unknown[]): Promise<Buffer>;
  buildCsv(data: unknown[]): Promise<Buffer>;
  fetchData(
    dateFrom?: string,
    dateTo?: string,
    filters?: string,
  ): Promise<unknown[]>;
}

@Injectable()
export class ExportsService {
  private readonly builders = new Map<ReportType, ExportBuilder>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Register an export builder for a given report type.
   * Called by feature modules during module initialization.
   */
  registerBuilder(reportType: ReportType, builder: ExportBuilder): void {
    this.builders.set(reportType, builder);
  }

  /**
   * Generate an export file: fetch data, build file, upload to R2, persist record.
   */
  async generateExport(
    dto: GenerateExportDto,
    userId: string,
    userPermissions: string[],
  ): Promise<{ downloadUrl: string; exportId: string }> {
    const config = EXPORT_TYPE_CONFIG[dto.reportType];
    if (!config) {
      throw new NotImplementedException(
        `Unknown report type: ${dto.reportType}`,
      );
    }

    // Fine-grained permission check (varies by report type)
    if (!userPermissions.includes(config.permission)) {
      throw new ForbiddenException(
        `You do not have permission to export ${config.label}. Required: ${config.permission}`,
      );
    }

    const builder = this.builders.get(dto.reportType);
    if (!builder) {
      throw new NotImplementedException(
        `Export builder not registered for: ${dto.reportType}`,
      );
    }

    // Fetch data
    const data = await builder.fetchData(
      dto.dateFrom,
      dto.dateTo,
      dto.filters,
    );

    // Build file
    const buffer =
      dto.format === 'xlsx'
        ? await builder.buildXlsx(data)
        : await builder.buildCsv(data);

    const contentType =
      dto.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv';

    // Upload to R2
    const key = this.buildExportKey(
      dto.reportType,
      dto.format,
      dto.dateFrom,
      dto.dateTo,
    );
    await this.storageService.putObjectDirect(key, buffer, contentType);
    const downloadUrl = this.storageService.getPublicUrl(key);

    // Persist export record
    const record = await this.prisma.exportRecord.create({
      data: {
        report_type: dto.reportType,
        format: dto.format,
        filters_applied: dto.filters ?? null,
        file_size_bytes: buffer.length,
        r2_key: key,
        download_url: downloadUrl,
        generated_by: userId,
        status: 'completed',
      },
    });

    return { downloadUrl, exportId: record.id };
  }

  /**
   * Retrieve export history with optional filters.
   */
  async getHistory(filters?: {
    reportType?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (filters?.reportType) {
      where.report_type = filters.reportType;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (filters.dateFrom) {
        createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        createdAt.lte = new Date(filters.dateTo);
      }
      where.created_at = createdAt;
    }

    return this.prisma.exportRecord.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        user: { select: { name: true } },
      },
    });
  }

  /**
   * Build the R2 storage key for an export file.
   * Pattern: exports/{reportType}/{YYYYMMDD}/{reportType}_{dateRange}_{timestamp}.{format}
   */
  buildExportKey(
    reportType: string,
    format: string,
    dateFrom?: string,
    dateTo?: string,
  ): string {
    const now = new Date();
    const dateFolder = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = now
      .toISOString()
      .replace(/[-:]/g, '')
      .slice(0, 15);
    const dateRange =
      dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : 'all';
    return `exports/${reportType}/${dateFolder}/${reportType}_${dateRange}_${timestamp}.${format}`;
  }
}
