import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import {
  FulfilmentType,
  ProductStatus,
  ProductType,
  StockMode,
} from '@prisma/client';

/**
 * Every field is optional: the ops menu screen patches a single `status` to
 * publish/unpublish (there is no `available` boolean on `Product`).
 */
export class UpdateProductDto {
  @IsOptional()
  @IsUUID()
  brand_id?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case (e.g. "sourdough-loaf")',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  story?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  base_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_rate?: number;

  @IsOptional()
  @IsString()
  hsn_code?: string;

  @IsOptional()
  @IsEnum(FulfilmentType)
  fulfilment?: FulfilmentType;

  @IsOptional()
  @IsEnum(StockMode)
  stock_mode?: StockMode;

  @IsOptional()
  @IsUUID()
  recipe_id?: string;

  @IsOptional()
  @IsUUID()
  event_id?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  weight_grams?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  shelf_life_days?: number;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
