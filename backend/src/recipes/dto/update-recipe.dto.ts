import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsInt,
  IsUUID,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BomLineDto } from './upsert-bom-lines.dto';

export class UpdateRecipeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  prep_steps?: string;

  @IsOptional()
  @IsString()
  cooking_method?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  yield_qty?: number;

  @IsOptional()
  @IsString()
  yield_unit?: string;

  @IsOptional()
  @IsString()
  portion_size?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  shelf_life_hours?: number;

  @IsOptional()
  @IsUUID()
  brand_id?: string;

  @IsOptional()
  @IsUUID()
  zone_id?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsIn(['draft', 'approved', 'archived'])
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomLineDto)
  bom_lines?: BomLineDto[];
}
