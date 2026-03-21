import { IsUUID, IsNumber, Min, IsString, IsDateString } from 'class-validator';

export class CreateVendorPriceDto {
  @IsUUID()
  vendor_id: string;

  @IsUUID()
  ingredient_id: string;

  @IsNumber()
  @Min(0.01)
  price: number;

  @IsString()
  unit: string;

  @IsDateString()
  effective_date: string;
}
