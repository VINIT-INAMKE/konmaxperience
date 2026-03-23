import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { IMPORT_TYPES, type ImportType } from '../import-types';
import type { ImportRow } from '../import-types';

export class CommitImportDto {
  @IsString()
  @IsIn([...IMPORT_TYPES])
  importType: ImportType;

  @IsArray()
  rows: ImportRow[];

  @IsBoolean()
  @IsOptional()
  updateExisting?: boolean;

  @IsArray()
  @IsOptional()
  bomRows?: ImportRow[];
}
