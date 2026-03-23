import { IsIn, IsOptional, IsString, IsDateString } from 'class-validator';
import { REPORT_TYPES } from '../export-types';
import type { ReportType } from '../export-types';

export class GenerateExportDto {
  @IsIn([...REPORT_TYPES])
  reportType: ReportType;

  @IsIn(['csv', 'xlsx'])
  format: 'csv' | 'xlsx';

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  filters?: string; // JSON-stringified additional filters
}
