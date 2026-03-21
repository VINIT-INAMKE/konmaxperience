import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['food', 'art', 'lifestyle'])
  brand_type: string;

  @IsOptional()
  @IsString()
  owner_user_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
