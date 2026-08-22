import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { ProductType } from '@prisma/client';

export class CreateProductCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  /** lowercase kebab; unique per node */
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case (e.g. "small-plates")',
  })
  slug!: string;

  @IsUUID()
  brand_id!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(ProductType, { each: true })
  product_types?: ProductType[];
}
