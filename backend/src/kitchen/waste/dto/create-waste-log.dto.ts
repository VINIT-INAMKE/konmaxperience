import {
  IsString,
  IsIn,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateWasteLogDto {
  @IsIn(['ingredient', 'prep_batch'])
  waste_type: string;

  @IsUUID()
  @IsOptional()
  ingredient_id?: string;

  @IsUUID()
  @IsOptional()
  prep_batch_id?: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsString()
  unit: string;

  @IsIn(['spoilage', 'over_prep', 'cooking_error', 'expired', 'other'])
  reason: string;

  @IsString()
  @IsOptional()
  reason_notes?: string;

  @IsUUID()
  zone_id: string;
}
