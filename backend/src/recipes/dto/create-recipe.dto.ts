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
} from 'class-validator';
import { Type } from 'class-transformer';
import { BomLineDto } from './upsert-bom-lines.dto';

export class CreateRecipeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  description!: string;

  @IsString()
  prep_steps!: string;

  @IsString()
  cooking_method!: string;

  @IsNumber()
  @Min(0.001)
  yield_qty!: number;

  @IsString()
  yield_unit!: string;

  @IsString()
  portion_size!: string;

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomLineDto)
  bom_lines?: BomLineDto[];
}
