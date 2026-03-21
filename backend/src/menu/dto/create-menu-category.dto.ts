import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

export class CreateMenuCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUUID()
  brand_id!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
