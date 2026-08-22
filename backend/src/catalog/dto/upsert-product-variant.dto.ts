import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class UpsertProductVariantDto {
  @IsUUID()
  product_id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  /** Globally unique — the upsert key. */
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsOptional()
  @IsNumber()
  price_delta?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock_on_hand?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  low_stock_threshold?: number;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
