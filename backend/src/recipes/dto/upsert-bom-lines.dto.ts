import {
  IsString,
  IsIn,
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BomLineDto {
  @IsIn(['ingredient', 'recipe'])
  input_type!: string;

  @IsUUID()
  item_id!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsString()
  prep_notes?: string;
}

export class UpsertBomLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomLineDto)
  bom_lines!: BomLineDto[];
}
