import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BomLineDto } from './upsert-bom-lines.dto';

export class CostPreviewDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomLineDto)
  bom_lines!: BomLineDto[];
}
