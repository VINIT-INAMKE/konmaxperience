import { IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IMPORT_TYPES, type ImportType } from '../import-types';
import type { ImportRow } from '../import-types';

class ImportRowDto {
  rowIndex: number;
  raw: Record<string, string>;
  validated: Record<string, unknown>;
  errors: Array<{ field: string; message: string }>;
  status: 'valid' | 'invalid' | 'duplicate' | 'blocked';
  existingId?: string;
}

export class CommitImportDto {
  @IsString()
  @IsIn([...IMPORT_TYPES])
  importType: ImportType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows: ImportRow[];

  @IsBoolean()
  @IsOptional()
  updateExisting?: boolean; // per D-17: toggle for upsert vs skip

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  @IsOptional()
  bomRows?: ImportRow[]; // Recipe BOM lines for two-pass commit (D-03)
}
