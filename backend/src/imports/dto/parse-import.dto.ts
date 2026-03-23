import { IsIn, IsString } from 'class-validator';
import { IMPORT_TYPES, type ImportType } from '../import-types';

export class ParseImportDto {
  @IsString()
  @IsIn([...IMPORT_TYPES])
  importType: ImportType;
}
