import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { UsageType } from '@prisma/client';

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEnum(UsageType)
  usage_type?: UsageType;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsString()
  @IsIn(['g', 'ml', 'pieces', 'kg', 'L'])
  base_unit: string;

  @IsNumber()
  @Min(0)
  min_stock_level: number;
}
