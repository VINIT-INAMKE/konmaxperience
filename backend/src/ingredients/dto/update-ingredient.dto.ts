import { IsString, IsOptional, IsIn, IsNumber, Min } from 'class-validator';

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['dairy', 'vegetable', 'spice', 'grain', 'meat', 'oil'])
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(['g', 'ml', 'pieces', 'kg', 'L'])
  base_unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_stock_level?: number;
}
