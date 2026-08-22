import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  Min,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { UsageType } from '@prisma/client';

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(UsageType)
  usage_type?: UsageType;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsString()
  @IsIn(['g', 'ml', 'pieces', 'kg', 'L'])
  base_unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_stock_level?: number;
}
