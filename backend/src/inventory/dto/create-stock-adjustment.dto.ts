import { IsUUID, IsNumber, IsString, IsNotEmpty } from 'class-validator';

export class CreateStockAdjustmentDto {
  @IsUUID()
  ingredient_id: string;

  @IsUUID()
  zone_id: string;

  @IsNumber()
  quantity: number; // signed: negative for deduction

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
