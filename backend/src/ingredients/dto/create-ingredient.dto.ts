import { IsString, IsNotEmpty, IsIn, IsNumber, Min } from 'class-validator';

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(['dairy', 'vegetable', 'spice', 'grain', 'meat', 'oil'])
  category: string;

  @IsString()
  @IsIn(['g', 'ml', 'pieces', 'kg', 'L'])
  base_unit: string;

  @IsNumber()
  @Min(0)
  min_stock_level: number;
}
