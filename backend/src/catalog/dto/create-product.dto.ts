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

export class CreateProductDto {
  @IsUUID()
  brand_id!: string;

  @IsUUID()
  category_id!: string;

  @IsEnum(ProductType)
  type!: ProductType;

  @IsString()
  @IsNotEmpty()
  name!: string;

  /** lowercase kebab; unique per node */
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case (e.g. "sourdough-loaf")',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  story?: string;

  @IsNumber()
  @Min(0.01)
  base_price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_rate?: number;

  @IsOptional()
  @IsString()
  hsn_code?: string;

  @IsEnum(FulfilmentType)
  fulfilment!: FulfilmentType;

  @IsEnum(StockMode)
  stock_mode!: StockMode;

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
