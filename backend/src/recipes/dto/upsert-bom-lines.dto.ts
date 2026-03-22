import {
  IsString,
  IsIn,
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';

export class BomLineDto {
  @IsIn(['ingredient', 'recipe'])
  input_type!: string;

  @IsUUID()
  item_id!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsString()
  prep_notes?: string;
}
